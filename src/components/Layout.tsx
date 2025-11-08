import { ReactNode } from 'react'
import Header from './Header'
import Footer from './Footer'
import Notification from './Notification'

interface LayoutProps {
  children: ReactNode
}

function Layout({ children }: LayoutProps) {
  return (
    <div className="d-flex flex-column min-vh-100">
      <Header />
      <Notification />
      <main className="flex-grow-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout
