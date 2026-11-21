import type { AssetInfo } from '@shumai/dtos'
import { FileCard } from '@/ui/components/file-browser/file-card'
import { FolderCard } from '@/ui/components/file-browser/folder-card'

export function SearchResultCards({
  results,
  teamId,
  projectId,
}: {
  results: AssetInfo[]
  teamId: string
  projectId: string
}) {
  function openResult(item: AssetInfo) {
    const projectPath = `/projects/${projectId}`
    if (item.type === 'folder') {
      window.open(`${projectPath}/folders/${item.id}`, '_blank', 'noopener,noreferrer')
      return
    }
    const fileId = item.versionStack?.id ?? item.id
    const query = item.startTime != null && item.startTime > 0 ? `?start=${item.startTime}` : ''
    window.open(`${projectPath}/files/${fileId}${query}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {results.map((item) => {
        const key =
          item.startTime != null && item.endTime != null
            ? `${item.id}-${item.startTime}-${item.endTime}`
            : item.id
        return item.type === 'folder' ? (
          <FolderCard
            key={key}
            item={item}
            hideCheckbox
            hideActions
            disabled
            onSelect={() => openResult(item)}
          />
        ) : (
          <FileCard
            key={key}
            teamId={teamId}
            item={item}
            hideCheckbox
            hideActions
            disabled
            onSelect={() => openResult(item)}
          />
        )
      })}
    </div>
  )
}
