export type Customer = {
  id: number
  name: string
  phone: string
  email: string
  address: string
  groups: string[]
  pendingDue: number
  totalPaid: number
  joinedDate: string
  status: "active" | "inactive"
  kycStatus: "verified" | "pending" | "rejected"
}

export type Employee = {
  id: number
  name: string
  role: "Manager" | "Agent" | "Accountant" | "Supervisor"
  branch: string
  phone: string
  email: string
  target: number
  collected: number
  joinedDate: string
  status: "active" | "inactive"
}

export type Collection = {
  id: number
  receiptNo: string
  customerId: number
  customerName: string
  group: string
  installment: number
  amount: number
  mode: "cash" | "online" | "cheque"
  date: string
  collectedBy: string
  status: "paid" | "pending" | "overdue"
  penalty: number
}

export type ChitGroup = {
  id: number
  branchName: string
  specialType: string
  group: string
  percentage: string
  amount: number
  startDate: string
  endDate: string
  /** Seats in the group. The roster is created to this size. */
  totalTickets: number
  /** Derived from the roster, never typed in: see syncGroupCounts. */
  vacants: number
  members: number
  status: "active" | "completed" | "upcoming"
}

export type MonthlyData = {
  month: string
  amount: number
}

export const CUSTOMERS: Customer[] = [
  { id: 1, name: "Rajesh Kumar", phone: "9876543210", email: "rajesh@gmail.com", address: "12, Main St, KovilPatti", groups: ["MIKEE18", "MIKB24"], pendingDue: 5000, totalPaid: 45000, joinedDate: "15/01/2025", status: "active", kycStatus: "verified" },
  { id: 2, name: "Priya Devi", phone: "9823456789", email: "priya@gmail.com", address: "34, Gandhi Nagar, Madurai", groups: ["MDRA10"], pendingDue: 0, totalPaid: 20000, joinedDate: "20/02/2025", status: "active", kycStatus: "verified" },
  { id: 3, name: "Murugan Selvam", phone: "9745612389", email: "murugan@gmail.com", address: "5, Temple Rd, Trichy", groups: ["TRCP15", "MIKK41"], pendingDue: 15000, totalPaid: 35000, joinedDate: "10/03/2025", status: "active", kycStatus: "pending" },
  { id: 4, name: "Lakshmi Priyanka", phone: "9632145870", email: "lakshmi@gmail.com", address: "78, Anna Salai, Chennai", groups: ["CHNB20"], pendingDue: 0, totalPaid: 60000, joinedDate: "05/01/2025", status: "active", kycStatus: "verified" },
  { id: 5, name: "Senthil Nathan", phone: "9512345678", email: "senthil@gmail.com", address: "22, Kovai Rd, Coimbatore", groups: ["CBEA30"], pendingDue: 8000, totalPaid: 72000, joinedDate: "01/12/2024", status: "active", kycStatus: "verified" },
  { id: 6, name: "Meena Kumari", phone: "9401234567", email: "meena@gmail.com", address: "15, Market St, Salem", groups: ["SLMF12"], pendingDue: 3000, totalPaid: 17000, joinedDate: "25/02/2025", status: "inactive", kycStatus: "rejected" },
  { id: 7, name: "Arjun Pandian", phone: "9312345678", email: "arjun@gmail.com", address: "9, Bypass Rd, KovilPatti", groups: ["MIKEE17", "MIKD42"], pendingDue: 0, totalPaid: 90000, joinedDate: "15/10/2024", status: "active", kycStatus: "verified" },
  { id: 8, name: "Kavitha Rajan", phone: "9234567812", email: "kavitha@gmail.com", address: "44, Nehru St, Madurai", groups: ["MDRA10", "MIKEE18"], pendingDue: 12000, totalPaid: 28000, joinedDate: "10/11/2024", status: "active", kycStatus: "pending" },
  { id: 9, name: "Durai Murugan", phone: "9876500001", email: "durai@gmail.com", address: "67, West St, Trichy", groups: ["TRCP15"], pendingDue: 0, totalPaid: 54000, joinedDate: "05/09/2024", status: "active", kycStatus: "verified" },
  { id: 10, name: "Sumathi Venkat", phone: "9876500002", email: "sumathi@gmail.com", address: "88, East St, Chennai", groups: ["CHNB20", "CBEA30"], pendingDue: 6000, totalPaid: 120000, joinedDate: "20/08/2024", status: "active", kycStatus: "verified" },
]

export const EMPLOYEES: Employee[] = [
  { id: 1, name: "Suresh Kumar", role: "Manager", branch: "KovilPatti", phone: "9876543001", email: "suresh@chit.com", target: 500000, collected: 480000, joinedDate: "01/01/2023", status: "active" },
  { id: 2, name: "Vijaya Lakshmi", role: "Accountant", branch: "KovilPatti", phone: "9876543002", email: "vijaya@chit.com", target: 0, collected: 0, joinedDate: "15/03/2023", status: "active" },
  { id: 3, name: "Karthik Raja", role: "Agent", branch: "Madurai", phone: "9876543003", email: "karthik@chit.com", target: 200000, collected: 185000, joinedDate: "01/06/2023", status: "active" },
  { id: 4, name: "Anitha Selvam", role: "Agent", branch: "Chennai", phone: "9876543004", email: "anitha@chit.com", target: 300000, collected: 320000, joinedDate: "10/08/2023", status: "active" },
  { id: 5, name: "Balamurugan P", role: "Supervisor", branch: "Trichy", phone: "9876543005", email: "bala@chit.com", target: 400000, collected: 390000, joinedDate: "20/09/2023", status: "active" },
  { id: 6, name: "Deepa Srinivasan", role: "Agent", branch: "Coimbatore", phone: "9876543006", email: "deepa@chit.com", target: 250000, collected: 210000, joinedDate: "01/01/2024", status: "active" },
  { id: 7, name: "Ragul Krishnan", role: "Agent", branch: "Salem", phone: "9876543007", email: "ragul@chit.com", target: 150000, collected: 80000, joinedDate: "15/04/2024", status: "inactive" },
]

export const COLLECTIONS: Collection[] = [
  { id: 1, receiptNo: "RCP-2026-001", customerId: 1, customerName: "Rajesh Kumar", group: "MIKEE18", installment: 3, amount: 5000, mode: "cash", date: "18/05/2026", collectedBy: "Suresh Kumar", status: "paid", penalty: 0 },
  { id: 2, receiptNo: "RCP-2026-002", customerId: 2, customerName: "Priya Devi", group: "MDRA10", installment: 2, amount: 4000, mode: "online", date: "18/05/2026", collectedBy: "Karthik Raja", status: "paid", penalty: 0 },
  { id: 3, receiptNo: "RCP-2026-003", customerId: 3, customerName: "Murugan Selvam", group: "TRCP15", installment: 1, amount: 6000, mode: "cash", date: "17/05/2026", collectedBy: "Balamurugan P", status: "overdue", penalty: 300 },
  { id: 4, receiptNo: "RCP-2026-004", customerId: 4, customerName: "Lakshmi Priyanka", group: "CHNB20", installment: 5, amount: 8000, mode: "cheque", date: "18/05/2026", collectedBy: "Anitha Selvam", status: "paid", penalty: 0 },
  { id: 5, receiptNo: "RCP-2026-005", customerId: 5, customerName: "Senthil Nathan", group: "CBEA30", installment: 6, amount: 10000, mode: "online", date: "17/05/2026", collectedBy: "Deepa Srinivasan", status: "paid", penalty: 0 },
  { id: 6, receiptNo: "RCP-2026-006", customerId: 6, customerName: "Meena Kumari", group: "SLMF12", installment: 2, amount: 3000, mode: "cash", date: "16/05/2026", collectedBy: "Suresh Kumar", status: "pending", penalty: 150 },
  { id: 7, receiptNo: "RCP-2026-007", customerId: 7, customerName: "Arjun Pandian", group: "MIKEE17", installment: 4, amount: 5000, mode: "online", date: "18/05/2026", collectedBy: "Suresh Kumar", status: "paid", penalty: 0 },
  { id: 8, receiptNo: "RCP-2026-008", customerId: 8, customerName: "Kavitha Rajan", group: "MIKEE18", installment: 3, amount: 5000, mode: "cash", date: "15/05/2026", collectedBy: "Suresh Kumar", status: "overdue", penalty: 500 },
  { id: 9, receiptNo: "RCP-2026-009", customerId: 9, customerName: "Durai Murugan", group: "TRCP15", installment: 7, amount: 6000, mode: "online", date: "14/05/2026", collectedBy: "Balamurugan P", status: "paid", penalty: 0 },
  { id: 10, receiptNo: "RCP-2026-010", customerId: 10, customerName: "Sumathi Venkat", group: "CHNB20", installment: 5, amount: 8000, mode: "cheque", date: "13/05/2026", collectedBy: "Anitha Selvam", status: "pending", penalty: 400 },
]

export const ALL_GROUPS: ChitGroup[] = [
  { id: 1, branchName: "KovilPatti", specialType: "Regular", group: "MIKEE18", percentage: "1L-25", amount: 100000, startDate: "21/03/2026", endDate: "21/10/2027", totalTickets: 20, vacants: 18, members: 7, status: "active" },
  { id: 2, branchName: "KovilPatti", specialType: "Regular", group: "MIKEE17", percentage: "1L-25", amount: 100000, startDate: "15/03/2026", endDate: "15/10/2027", totalTickets: 20, vacants: 3, members: 22, status: "active" },
  { id: 3, branchName: "KovilPatti", specialType: "Regular", group: "MIKB24", percentage: "10L-25", amount: 1000000, startDate: "20/03/2026", endDate: "20/10/2027", totalTickets: 20, vacants: 10, members: 15, status: "active" },
  { id: 4, branchName: "KovilPatti", specialType: "Regular", group: "MIKD42", percentage: "5L-25", amount: 500000, startDate: "13/03/2026", endDate: "13/10/2027", totalTickets: 20, vacants: 3, members: 22, status: "active" },
  { id: 5, branchName: "KovilPatti", specialType: "Regular", group: "MIKK41", percentage: "3L-25", amount: 300000, startDate: "11/03/2026", endDate: "11/10/2027", totalTickets: 20, vacants: 4, members: 21, status: "active" },
  { id: 6, branchName: "Madurai", specialType: "Special", group: "MDRA10", percentage: "2L-25", amount: 200000, startDate: "05/03/2026", endDate: "05/10/2027", totalTickets: 20, vacants: 7, members: 18, status: "active" },
  { id: 7, branchName: "Chennai", specialType: "Regular", group: "CHNB20", percentage: "5L-25", amount: 500000, startDate: "01/03/2026", endDate: "01/10/2027", totalTickets: 20, vacants: 12, members: 13, status: "active" },
  { id: 8, branchName: "Trichy", specialType: "Premium", group: "TRCP15", percentage: "5L-25", amount: 500000, startDate: "18/03/2026", endDate: "18/10/2027", totalTickets: 20, vacants: 5, members: 20, status: "active" },
  { id: 9, branchName: "Coimbatore", specialType: "Regular", group: "CBEA30", percentage: "10L-25", amount: 1000000, startDate: "10/03/2026", endDate: "10/10/2027", totalTickets: 20, vacants: 2, members: 23, status: "active" },
  { id: 10, branchName: "Salem", specialType: "Special", group: "SLMF12", percentage: "1L-25", amount: 100000, startDate: "07/03/2026", endDate: "07/10/2027", totalTickets: 20, vacants: 9, members: 16, status: "active" },
]

export const MONTHLY_COLLECTIONS: MonthlyData[] = [
  { month: "Dec", amount: 420000 },
  { month: "Jan", amount: 380000 },
  { month: "Feb", amount: 450000 },
  { month: "Mar", amount: 510000 },
  { month: "Apr", amount: 490000 },
  { month: "May", amount: 560000 },
]

export const DASHBOARD_STATS = {
  totalCollections: 2810000,
  activeGroups: 144,
  totalCustomers: 1248,
  pendingDues: 287500,
  todayCollections: 46000,
  monthTarget: 600000,
  monthCollected: 560000,
  overduePenalties: 12400,
}
