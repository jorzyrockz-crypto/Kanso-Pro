import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/newsreader/standard.css'
import '@fontsource-variable/newsreader/standard-italic.css'
import App from './App'
import './styles.css'
import './layout.css'
import './occasions.css'
import './months.css'
import './account.css'
import './sign-in.css'
import './settings.css'
import './theme.css'
import './fluid.css'
import './activity.css'
import './collaboration.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
