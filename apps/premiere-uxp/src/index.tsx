import './polyfills'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@swc-react/theme'
import '@spectrum-web-components/theme/theme-dark.js'
import '@spectrum-web-components/theme/theme-darkest.js'
import '@spectrum-web-components/theme/theme-light.js'
import '@spectrum-web-components/theme/scale-medium.js'
import '@swc-uxp-wrappers/button/sp-button.js'
import '@swc-uxp-wrappers/action-button/sp-action-button.js'
import '@swc-uxp-wrappers/menu/sp-menu.js'
import '@swc-uxp-wrappers/menu/sp-menu-item.js'
import '@swc-uxp-wrappers/menu/sp-menu-divider.js'
import '@swc-uxp-wrappers/menu/sp-menu-group.js'
import '@swc-uxp-wrappers/popover/sp-popover.js'
import '@spectrum-web-components/action-menu/sp-action-menu.js'
import '@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js'
import '@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js'
import '@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-right.js'
import '@spectrum-web-components/icons-workflow/icons/sp-icon-log-out.js'
import '@spectrum-web-components/icons-workflow/icons/sp-icon-arrow-right.js'
import { App } from './App'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <Theme theme="spectrum" scale="medium" color="dark">
        <App />
      </Theme>
    </React.StrictMode>,
  )
} else {
  console.error('Failed to find root container element')
}
