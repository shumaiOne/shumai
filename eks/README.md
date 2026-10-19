# Shumai on AWS EKS with KEDA & Scale-to-Zero On-Demand Workers

This directory contains a complete, production-ready Kubernetes deployment example for running Shumai on **Amazon Elastic Kubernetes Service (Amazon EKS)**, using **KEDA (Kubernetes Event-driven Autoscaling)** and **Scale-to-Zero On-Demand AWS Graviton5 instances** for compute-intensive media processing.

The example should also be straightforward to adapt to any standard Kubernetes cluster.

To demonstrate a fully self-hosted setup, it uses Garage as an S3-compatible object storage solution. However, if you're deploying on AWS, consider using **Amazon S3** instead of running your own S3-compatible storage server, as it is managed and highly scalable.

---

## Architecture Overview

```text
                                [ User / Internet ]
                                         │
                    ┌────────────────────┴────────────────────┐
                    │ (Port 80/3000)                          │ (Port 3900)
                    ▼                                         ▼
        ┌───────────────────────┐                 ┌───────────────────────┐
        │  shumai-server (ELB)  │                 │  garage-public (ELB)  │
        └───────────┬───────────┘                 └───────────┬───────────┘
                    │                                         │ Direct Browser Uploads
                    │                                         ▼ (Presigned URLs)
┌───────────────────┼─────────────────────────────────────────────────────────────────┐
│ General Workload Node (c9g.large On-Demand, ~$0.087/hr)                             │
│                   │                                                                 │
│                   ▼                                                                 │
│       ┌───────────────────────┐   Enqueue DBOS Tasks    ┌───────────────────┐       │
│       │     shumai-server     ├────────────────────────►│  shumai-postgres  │       │
│       │(SHUMAI_WORKERS=agent) │   (transcode_queue)     │  (pgvector:pg18)  │       │
│       │ [Stale Recovery Loop] │                         │                   │       │
│       └───────────┬───────────┘                         └─────────┬─────────┘       │
│                   │ Internal S3 Traffic                           │                 │
│                   ▼                                               │                 │
│       ┌───────────────────────┐                                   │                 │
│       │       garage-s3       │                                   │                 │
│       │    (dxflrs/garage)    │                                   │                 │
│       └───────────▲───────────┘                                   │                 │
└───────────────────┼───────────────────────────────────────────────┼─────────────────┘
                    │ Read Source / Write Proxies                   │
                    │                                               │ KEDA monitors
                    │                                               ▼ dbos.workflow_status
                    │                         ┌───────────────────────────────────────┐
                    │                         │ KEDA Controller: ScaledJob            │
                    │                         │ Spawns Jobs based on pending tasks    │
                    │                         └───────────────────┬───────────────────┘
                    │                                             │
                    │                                             ▼ Creates K8s Jobs
┌───────────────────┴─────────────────────────────────────────────────────────────────┐
│ Transcode Compute Pool (c9g.xlarge Graviton5 On-Demand, minSize: 0, maxSize: 5)      │
│                                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────┐ │
│  │   Job: transcode-job-1   │  │   Job: transcode-job-2   │  │Job: transcode-job-N│ │
│  │   (Auto-Drain Worker)    │  │   (Auto-Drain Worker)    │  │ (Auto-Drain Worker)│ │
│  └────────────┬─────────────┘  └────────────┬─────────────┘  └──────────┬─────────┘ │
│               ▼                             ▼                           ▼           │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌────────────────────┐ │
│  │   Node 1: c9g.xlarge     │  │   Node 2: c9g.xlarge     │  │ Node N: c9g.xlarge │ │
│  │     (On-Demand)          │  │     (On-Demand)          │  │     (On-Demand)    │ │
│  └──────────────────────────┘  └──────────────────────────┘  └────────────────────┘ │
│                                                                                     │
│  Scale-to-Zero: When queue is empty, 0 Jobs run and 0 EC2 instances are billed!     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Design Principles

### 1. Scale-to-Zero On-Demand Instances (`minSize: 0`)

Media transcoding with FFmpeg is bursty: hours may pass with zero transcoding activity, followed by sudden batches of 4K video uploads.

- **Zero Idle Cost**: The transcode node group [`eks/eks-cluster.yaml`](./eks-cluster.yaml) is configured with `minSize: 0` and `desiredCapacity: 0`. When no media transcoding tasks are active, **zero transcode EC2 instances exist**, costing **$0/hr**.
- **No Spot Interruption Risk**: Transcoding jobs run on AWS Graviton5 **On-Demand** instances (`c9g.xlarge`, ~$0.174/hr). This eliminates the risk of Spot instances being reclaimed mid-encode by AWS, preventing wasted CPU cycles and avoiding unexpected transcoding delays.

### 2. KEDA `ScaledJob` vs. `Deployment` / `StatefulSet`

Standard Kubernetes Horizontal Pod Autoscaler (HPA) scales `Deployment` replicas based on metrics like CPU utilization. However, HPAs on Deployments suffer from severe limitations during video processing:
1. When a 1-minute video finishes on Pod A while a 30-minute video is still encoding on Pod B, CPU drops and HPA reduces replica count, which can arbitrarily terminate Pod B mid-encode.
2. StatefulSets scale down in strict ordinal order (`pod-4`, `pod-3`, etc.), which would terminate `pod-4` even if `pod-4` is the only pod currently transcoding!

**KEDA `ScaledJob` solves this natively**:
- KEDA queries PostgreSQL directly:
  ```sql
  SELECT COUNT(*) FROM dbos.workflow_status WHERE queue_name = 'transcode_queue' AND status IN ('ENQUEUED', 'PENDING');
  ```
- KEDA spawns independent Kubernetes `Job` pods based on enqueued workload.
- Each Job runs the transcode worker with an idle timeout (`SHUMAI_WORKER_IDLE_TIMEOUT_MS=10000`).
- When the job drains its tasks and becomes idle, the pod exits `0` and Kubernetes marks the Job completed.
- Completing or terminating one job **never impacts any other job**!

### 3. Idle-Timeout Auto-Drain (10s Inactivity Shutdown)

In [`eks/shumai-transcode.yaml`](./shumai-transcode.yaml), the worker container runs with `SHUMAI_WORKER_IDLE_TIMEOUT_MS: "10000"`:
- **Concurrency Isolation**: Transcode concurrency is set to `1` per pod (`CONCURRENCY_TRANSCODE=1`). Each pod has exclusive access to the node's 4 vCPUs for FFmpeg.
- **Batch Processing Without Cold Starts**: Unlike single-task execution, a running worker continuously pulls tasks from `transcode_queue`. When a user uploads 100 images or multiple video files, a warm worker processes them back-to-back in seconds without restarting the container or control plane churn.
- **Automatic Scale-to-Zero**: When `activeWorkflows === 0` and no new task arrives within 10 consecutive seconds, the worker initiates graceful DBOS shutdown and exits with code `0`.
- The completed Job pod terminates, freeing the node so Cluster Autoscaler can terminate the EC2 instance down to zero.

---

## Step-by-Step Deployment Guide

### Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`).
- [`eksctl`](https://eksctl.io/) installed.
- [`kubectl`](https://kubernetes.io/docs/tasks/tools/) installed.
- [`helm`](https://helm.sh/) installed.

### Step 1: Provision the EKS Cluster

Create the cluster using the declarative [`eks/eks-cluster.yaml`](./eks-cluster.yaml) configuration:

```bash
eksctl create cluster -f eks/eks-cluster.yaml
```

This provisions:
- An EKS 1.31 control plane in `us-east-1` across multiple AZs. *(Note: AWS Graviton5 `c9g` instances are available in `us-east-1`. If deploying to a region where `c9g` is not yet offered, substitute `c7g.large` / `c7g.xlarge` or `c8g` in `eks/eks-cluster.yaml`.)*
- `shumai-general`: 1x `c9g.large` On-Demand instance (labeled `workload: general`) for API, database, and storage.
- `shumai-transcode`: Scale-to-zero `c9g.xlarge` On-Demand instance pool (`minSize: 0`, `maxSize: 5`, `desiredCapacity: 0`, tainted `dedicated=transcode:NoSchedule`).
- AWS EBS CSI Driver with IAM OIDC roles.

### Step 2: Install KEDA

Install KEDA using Helm:

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update
helm install keda kedacore/keda --namespace keda --create-namespace
```

Wait for the KEDA operator to reach `Running` state:

```bash
kubectl wait --namespace keda --for=condition=ready pod -l app.kubernetes.io/name=keda-operator --timeout=120s
```

### Step 3: Deploy the Shumai Stack

Deploy all components with Kustomize:

```bash
kubectl apply -k eks/
```

This applies:
- [`eks/storageclass.yaml`](./storageclass.yaml): Configures `gp3` as the default StorageClass using `ebs.csi.aws.com` with `WaitForFirstConsumer` binding and dynamic EBS volume expansion.
- PostgreSQL (`pgvector:pg18`) with durable EBS storage.
- Garage S3 object store with automatic bucket and CORS initialization (`garage-init` job).
- Shumai API & Web server.
- KEDA `ScaledJob` for transcode worker auto-scaling.

Wait for the core database and storage services to initialize:

```bash
# Wait for PostgreSQL and Garage S3 pods to become Ready
kubectl wait --namespace shumai --for=condition=ready pod -l app=shumai-postgres --timeout=180s
kubectl wait --namespace shumai --for=condition=ready pod -l app=garage --timeout=180s

# Wait for the bucket initialization job to complete
kubectl wait --namespace shumai --for=condition=complete job/garage-init --timeout=180s

# Verify all pods in the shumai namespace
kubectl get pods -n shumai -o wide
```

*(Note: On first startup, `shumai-server` automatically runs database migrations against PostgreSQL; this may take 30–60 seconds before the server reaches `Running (1/1)`.)*

### Step 4: Configure Public Access & S3 Endpoint

AWS automatically provisions external Elastic Load Balancers for `shumai-server` and `garage-public`. Because AWS takes 30–60 seconds to allocate external hostnames, wait for the hostnames to become available:

```bash
# Wait for AWS to assign external hostnames to the LoadBalancers
echo "Waiting for LoadBalancer external hostnames..."
until [ -n "$(kubectl get svc garage-public -n shumai -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')" ]; do
  sleep 5
done

GARAGE_ELB=$(kubectl get svc garage-public -n shumai -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
SERVER_ELB=$(kubectl get svc shumai-server -n shumai -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Garage S3 Hostname: http://${GARAGE_ELB}:3900"
echo "Shumai Web UI:     http://${SERVER_ELB}"
```

Inject the public Garage S3 hostname into `shumai-server` so that browsers generate correct presigned upload URLs:

```bash
kubectl set env deployment/shumai-server -n shumai AWS_PUBLIC_ENDPOINT_URL_S3="http://${GARAGE_ELB}:3900"
```

*(Note: In production with custom domains, point your DNS CNAME records to the load balancers and configure `AWS_PUBLIC_ENDPOINT_URL_S3: https://s3.mycompany.com` in [`eks/config.yaml`](./config.yaml).)*

### Step 5: Deploy Kubernetes Cluster Autoscaler

Deploy Cluster Autoscaler to dynamically provision `c9g.xlarge` EC2 nodes when KEDA jobs are created:

```bash
curl -s https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml \
  | sed 's/<YOUR CLUSTER NAME>/shumai-eks/g' \
  | kubectl apply -f -

# Pin autoscaler to the general workload node
kubectl patch deployment cluster-autoscaler -n kube-system -p '{"spec":{"template":{"spec":{"nodeSelector":{"workload":"general"}}}}}'
```

### Step 6: Test Scale-to-Zero Queue-Driven Autoscaling

1. Open `http://${SERVER_ELB}` in your browser and register an account via **Sign Up**. *(The first registered account automatically becomes the instance administrator).*
2. Create a project and upload a batch of 5–10 video files simultaneously.
3. Observe KEDA detecting pending DBOS tasks and spawning individual Kubernetes Jobs:
   ```bash
   kubectl get scaledjobs -n shumai
   kubectl get jobs -n shumai -w
   kubectl get pods -n shumai -l app=shumai-transcode -o wide
   kubectl get nodes -L role,workload
   ```
4. Watch Cluster Autoscaler dynamically provision dedicated `c9g.xlarge` Graviton5 EC2 instances for the Jobs.
5. As each video finishes transcoding, its worker pod exits `0` and completes immediately.
6. Once all jobs are done, KEDA holds 0 jobs, and Cluster Autoscaler terminates all transcode EC2 instances, returning the transcode pool to **0 nodes ($0/hr)**!

### Step 7: Cluster Teardown & Cost Cleanup

When you are finished testing, delete all resources to prevent ongoing cloud charges:

```bash
# 1. Delete Kubernetes namespace first to release AWS ELB load balancers and EBS volumes
# (Important: Wait for this to complete so AWS SecurityGroups can be deleted without dependency conflicts)
kubectl delete namespace shumai

# 2. Uninstall KEDA
helm uninstall keda -n keda
kubectl delete namespace keda

# 3. Delete the EKS cluster and CloudFormation stacks
eksctl delete cluster -f eks/eks-cluster.yaml --wait

# 4. Confirm all AWS resources are released
aws eks list-clusters --region us-east-1
```
