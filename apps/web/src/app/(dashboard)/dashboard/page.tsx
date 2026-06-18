import { FileTable } from '@/components/FileTable'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Files</h1>
      <FileTable />
    </div>
  )
}
