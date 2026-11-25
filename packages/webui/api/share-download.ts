import { client } from './client'

export function requestShareDownload(
  shareId: string,
  fileId: string,
  key: string,
  purpose?: 'download' | 'prepare' | 'clipboard',
) {
  const password = localStorage.getItem(`share_pwd_${shareId}`)
  const postDownload = client.api.shares[':shareId'].files[':fileId']['download-url'].$post
  const input = { param: { shareId, fileId }, json: { key, purpose } }
  return password
    ? postDownload(input, { headers: { 'x-share-password': password } })
    : postDownload(input)
}
