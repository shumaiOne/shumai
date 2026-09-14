import React from 'react'
import { createRoot } from 'react-dom/client'
import { Theme } from '@swc-react/theme'
import '@spectrum-web-components/theme/theme-dark.js'
import '@spectrum-web-components/theme/theme-darkest.js'
import '@spectrum-web-components/theme/theme-light.js'
import '@spectrum-web-components/theme/scale-medium.js'
import { App } from './App'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <Theme system="spectrum" scale="medium" color="dark">
        <App />
      </Theme>
    </React.StrictMode>,
  )
} else {
  console.error('Failed to find root container element')
}
