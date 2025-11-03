import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api/config'

interface Branch {
  branch_id: number
  branch_name: string
  address?: string
}

interface BranchContextType {
  branches: Branch[]
  branchId: number | null
  setBranchId: (id: number | null) => void
}

const BranchContext = createContext<BranchContextType>({
  branches: [],
  branchId: null,
  setBranchId: () => {},
})

export const BranchProvider = ({ children }: { children: React.ReactNode }) => {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<number | null>(null)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await fetch(api('/branches'))
        const data = await res.json()
        if (data.success) setBranches(data.data.branches)
        else console.error('Failed to load branches:', data.message)
      } catch (err) {
        console.error('Branch fetch error:', err)
      }
    }
    fetchBranches()
  }, [])

  return (
    <BranchContext.Provider value={{ branches, branchId, setBranchId }}>
      {children}
    </BranchContext.Provider>
  )
}

export const useBranch = () => useContext(BranchContext)
