# Shumai Kubernetes Deployment & Autoscaling Example

This directory contains a complete, production-ready Kubernetes example demonstrating how to run Shumai in a decoupled, horizontally scalable architecture powered by **DBOS Transact** and **Garage S3** (`dxflrs/garage`).

---

## Architecture Overview

```text
                                [ User / Ingress ]
                                        │
                                        ▼ (Port 3000)
                        ┌───────────────────────────────┐
                        │   shumai-server (Deployment)  │
                        │     SHUMAI_WORKERS=agent      │
                        └───────┬───────────────┬───────┘
                                │               │
          DBOS Task Submissions │               │ Direct S3 Uploads/Reads
         (Queue: transcode_queue)│               │
                                ▼               ▼
                 ┌──────────────────────┐ ┌───────────────┐
                 │   shumai-postgres    │ │   garage-s3   │
                 │   (pgvector:pg18)    │ │ (dxflrs/garage)│
                 └──────────┬───────────┘ └───────▲───────┘
                            │                     │
               DBOS Queue   │                     │ Fetch source video
                Polling     │                     │ Store transcoded proxies
                            ▼                     │
                 ┌──────────────────────┐         │
                 │   shumai-transcode   ├─────────┘
                 │ (1..5 Autoscaled Pods)
                 └──────────────────────┘
                            ▲
                            │ CPU Utilization Target (70%)
                 ┌──────────────────────┐
                 │  shumai-transcode-hpa │
                 │      (min: 1, max: 5) │
                 └──────────────────────┘
```

1. **`shumai-server`**: Serves the Web dashboard and REST API, while processing agent workflows. It sets `SHUMAI_WORKERS=agent` so that all video and media transcoding tasks are delegated directly to the `transcode_queue` in PostgreSQL.
2. **`shumai-transcode`**: Dedicated stateless worker pool consuming tasks from `transcode_queue`. Each replica uses the Kubernetes Downward API to set `POD_NAME` for unique, collision-free DBOS executor identity.
3. **`garage`**: Lightweight distributed S3-compatible object storage (`dxflrs/garage`) providing high-performance shared storage for original and transcoded media files without requiring external cloud storage.
4. **`shumai-postgres`**: PostgreSQL database with `pgvector:pg18` running both application persistence and DBOS workflow queues.
5. **`shumai-transcode-hpa`**: `HorizontalPodAutoscaler` (`autoscaling/v2`) that monitors transcode worker CPU utilization and scales the pool between **1 and 5 replicas**.

---

## Quickstart: Deploy to Kubernetes

### Prerequisites
- A Kubernetes cluster (e.g. Docker Desktop, Minikube, Kind, or managed cloud Kubernetes).
- `kubectl` configured with cluster access.
- `metrics-server` installed in your cluster (required by HPA to read CPU metrics).

### 1. Deploy the Entire Stack
Run a single command using Kustomize:

```bash
kubectl apply -k k8s/
```

### 2. Monitor Pod Status
Watch until all components are running and initialized:

```bash
kubectl get pods -n shumai -w
```

Expected output:
```text
NAME                                READY   STATUS      RESTARTS   AGE
garage-0                            1/1     Running     0          1m
garage-init-xxxxx                   0/1     Completed   0          45s
shumai-postgres-0                   1/1     Running     0          1m
shumai-server-xxxxxxxxxx-xxxxx      1/1     Running     0          1m
shumai-transcode-yyyyyyyyyy-yyyyy   1/1     Running     0          1m
```

### 3. Check Autoscaling Status
Inspect the HorizontalPodAutoscaler:

```bash
kubectl get hpa -n shumai
```

You should see:
```text
NAME                    REFERENCE                     TARGETS        MINPODS   MAXPODS   REPLICAS   AGE
shumai-transcode-hpa   Deployment/shumai-transcode   0%/70%         1         5         1          1m
```

### 4. Access the Dashboard & S3 Storage

In Kubernetes, the services are created as internal `ClusterIP` services by default. To interact with the stack from your local machine:

#### Step A: Port-forward the Web Server
Forward port 3000 to access the web application:
```bash
kubectl port-forward -n shumai svc/shumai-server 3000:3000
```
Open your browser to **`http://localhost:3000`**.

#### Step B: Port-forward In-Cluster S3 Storage (Garage)
Shumai generates direct client-to-S3 presigned URLs configured via `AWS_PUBLIC_ENDPOINT_URL_S3` (`http://localhost:3900`). To allow your browser to upload and stream media files directly:

```bash
kubectl port-forward -n shumai svc/garage 3900:3900
```

> [!NOTE]
> **AWS EKS Deployment with Graviton3 Spot Instances**: For production deployments on AWS with dedicated high-performance ARM64 transcoding, see [`k8s/eks-cluster.yaml`](file:///Users/yiling/Projects/shumai/k8s/eks-cluster.yaml) and the [Distributed Deployment Guide](file:///Users/yiling/Projects/shumai/docs/configuration/distributed.mdx#deploying-on-aws-eks-with-graviton3-spot-instances-c7gxlarge). It provisions a lightweight 2c4g node for general services and auto-scales dedicated `c7g.xlarge` Spot instances for media processing.

---

## Testing Transcoding & Horizontal Autoscaling

1. Upload one or more video files in the Shumai Web UI.
2. Observe the `shumai-transcode` worker pod picking up the transcode tasks in its logs:
   ```bash
   kubectl logs -n shumai -l app=shumai-transcode -f
   ```
3. When multiple heavy video transcoding jobs run concurrently, CPU utilization increases past 70%, triggering the HPA to scale up additional worker pods:
   ```bash
   kubectl get hpa -n shumai -w
   ```
4. Once transcoding completes, the HPA will hold replicas for a 300-second stabilization window before cleanly scaling back down to 1 pod.
