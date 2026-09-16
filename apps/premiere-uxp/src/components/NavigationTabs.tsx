import React from 'react'

export type MainTab = 'sequences' | 'browse'

export interface NavigationTabsProps {
  activeTab: MainTab
  onTabChange: (tab: MainTab) => void
  linkedCount?: number
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
  linkedCount = 0,
}) => {
  return (
    <div className="shumai-nav-tabs-bar" role="tablist">
      <sp-button
        size="s"
        variant={activeTab === 'sequences' ? 'accent' : 'secondary'}
        treatment="fill"
        onClick={() => onTabChange('sequences')}
        className={`shumai-tab-sp-btn ${activeTab === 'sequences' ? 'active' : ''}`}
      >
        <span className="shumai-tab-label">Sequences</span>
        {linkedCount > 0 && (
          <span className="shumai-tab-badge" title={`${linkedCount} linked sequence assets`}>
            {linkedCount}
          </span>
        )}
      </sp-button>

      <sp-button
        size="s"
        variant={activeTab === 'browse' ? 'accent' : 'secondary'}
        treatment="fill"
        onClick={() => onTabChange('browse')}
        className={`shumai-tab-sp-btn ${activeTab === 'browse' ? 'active' : ''}`}
      >
        <span className="shumai-tab-label">Browse</span>
      </sp-button>
    </div>
  )
}
