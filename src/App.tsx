/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { 
  Clock, 
  User, 
  Calendar, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  History,
  Plus,
  LogOut,
  Lock,
  ShieldCheck,
  UserCircle,
  Download,
  Search,
  ChevronDown,
  BarChart2,
  PieChart as PieChartIcon,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import PageTitle from "./PageTitle";
interface Employee {
  id: number;
  name: string;
  role: 'admin' | 'employee' | 'developer';
  category?: string;
  username?: string;
}

interface DTRRecord {
  id?: number;
  employee_id: number;
  employee_name?: string;
  date: string;
  morning_in: string;
  morning_out: string;
  afternoon_in: string;
  afternoon_out: string;
  remarks: string;
}

interface UserSession {
  id: number;
  name: string;
  role: 'admin' | 'employee' | 'developer';
}

const SCHEDULES = {
  JHS: {
    amIn: '07:15',
    amOut: '11:55',
    pmIn: '13:00',
    pmOut: '16:30',
    label: '7:15-11:55; 1:00-4:30'
  },
  SHS: {
    amIn: '07:15',
    amOut: '11:50',
    pmIn: '13:00',
    pmOut: '16:30',
    label: '7:15-11:50; 1:00-4:30'
  },
  NON_TEACHING: {
    amIn: '08:00',
    amOut: '12:00',
    pmIn: '13:00',
    pmOut: '17:00',
    label: '8:00-12:00; 1:00-5:00'
  }
};

const formatTo12h = (time24: string) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const hours = h % 12 || 12;
  return `${hours}:${m.toString().padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('dtr_user');
    return saved ? JSON.parse(saved) : null;
  });

  return (
    <>
      <PageTitle title="GNHS DTRMS" />
      {/* Your existing JSX goes here */}
    </>
  );
}
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('dtr_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | ''>('');
  const [activeDropdown, setActiveDropdown] = useState<'JHS' | 'SHS' | 'NON_TEACHING' | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [view, setView] = useState<'dtr' | 'stats' | 'developer'>('dtr');
  const [allMonthRecords, setAllMonthRecords] = useState<DTRRecord[]>([]);
  const [showAddPersonnelModal, setShowAddPersonnelModal] = useState(false);
  
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  
  const [monthlyRecords, setMonthlyRecords] = useState<Record<string, DTRRecord>>({});
  const [pendingRecords, setPendingRecords] = useState<Record<string, DTRRecord>>({});
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchEmployees();
      if (user.role === 'employee') {
        setSelectedEmployeeId(user.id);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedEmployeeId) {
      fetchMonthlyRecords();
    }
  }, [user, selectedEmployeeId, year, month]);

  useEffect(() => {
    if (user?.role === 'admin' && view === 'stats') {
      fetchAllMonthRecords();
    }
  }, [user, view, year, month]);

  const fetchAllMonthRecords = async () => {
    try {
      const res = await fetch(`/api/records/all/${year}/${month}`, {
        headers: { 'x-user-id': user?.id.toString() || '' }
      });
      const data = await res.json();
      setAllMonthRecords(data);
    } catch (err) {
      console.error('Failed to fetch all records', err);
    }
  };

  const calculateStats = () => {
    const stats: Record<number, { id: number, name: string, lates: number, absences: number, category: string }> = {};
    
    employees.forEach(emp => {
      if (emp.role === 'admin') return;
      stats[emp.id] = { id: emp.id, name: emp.name, lates: 0, absences: 0, category: emp.category || 'JHS' };
    });

    allMonthRecords.forEach(record => {
      if (!stats[record.employee_id]) return;
      
      const schedule = SCHEDULES[record.category as keyof typeof SCHEDULES] || SCHEDULES.JHS;
      
      const parseTime = (t: string) => {
        if (!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      const amIn = parseTime(record.morning_in);
      const pmIn = parseTime(record.afternoon_in);
      const offAmIn = parseTime(schedule.amIn)!;
      const offPmIn = parseTime(schedule.pmIn)!;

      if (amIn && amIn > offAmIn) stats[record.employee_id].lates += (amIn - offAmIn);
      if (pmIn && pmIn > offPmIn) stats[record.employee_id].lates += (pmIn - offPmIn);
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    employees.forEach(emp => {
      if (emp.role === 'admin') return;
      
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const dayDate = new Date(year, month - 1, d);
        const dayOfWeek = dayDate.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) continue; 

        const record = allMonthRecords.find(r => r.employee_id === emp.id && r.date === dateStr);
        if (!record || (!record.morning_in && !record.afternoon_in)) {
           if (record?.remarks?.toLowerCase().includes('holiday') || record?.remarks?.toLowerCase().includes('leave')) {
             continue;
           }
           stats[emp.id].absences += 1;
        }
      }
    });

    return Object.values(stats);
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', {
        headers: { 'x-user-id': user?.id.toString() || '' }
      });
      const data = await res.json();
      setEmployees(data);
    } catch (err) {
      console.error('Failed to fetch employees', err);
    }
  };

  const fetchMonthlyRecords = async () => {
    if (!selectedEmployeeId) return;
    try {
      const res = await fetch(`/api/records/employee/${selectedEmployeeId}/${year}/${month}`, {
        headers: { 'x-user-id': user?.id.toString() || '' }
      });
      const data = await res.json() as DTRRecord[];
      const recordMap: Record<string, DTRRecord> = {};
      data.forEach((r: DTRRecord) => {
        recordMap[r.date] = r;
      });
      setMonthlyRecords(recordMap);
      setPendingRecords(recordMap);
    } catch (err) {
      console.error('Failed to fetch records', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        localStorage.setItem('dtr_user', JSON.stringify(userData));
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (err) {
      setLoginError('Connection error');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('dtr_user');
    setUsername('');
    setPassword('');
  };

  const handleSaveDay = async (date: string, morning_in: string, morning_out: string, afternoon_in: string, afternoon_out: string, remarks: string) => {
    if (!selectedEmployeeId) return false;

    try {
      const res = await fetch('/api/records', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': user?.id.toString() || ''
        },
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          date,
          morning_in,
          morning_out,
          afternoon_in,
          afternoon_out,
          remarks,
        }),
      });

      if (res.ok) {
        return true;
      }
    } catch (err) {
      console.error(err);
    }
    return false;
  };

  const handleSaveAll = async () => {
    if (!selectedEmployeeId) return;
    setSavingAll(true);
    setStatus(null);

    const modifiedDates = Object.keys(pendingRecords).filter(date => {
      const pending = pendingRecords[date];
      const original = monthlyRecords[date] || { morning_in: '', morning_out: '', afternoon_in: '', afternoon_out: '', remarks: '' };
      return pending.morning_in !== (original.morning_in || '') ||
             pending.morning_out !== (original.morning_out || '') ||
             pending.afternoon_in !== (original.afternoon_in || '') ||
             pending.afternoon_out !== (original.afternoon_out || '') ||
             pending.remarks !== (original.remarks || '');
    });

    if (modifiedDates.length === 0) {
      setSavingAll(false);
      return;
    }

    let successCount = 0;
    for (const date of modifiedDates) {
      const p = pendingRecords[date];
      const success = await handleSaveDay(date, p.morning_in, p.morning_out, p.afternoon_in, p.afternoon_out, p.remarks);
      if (success) successCount++;
    }

    if (successCount === modifiedDates.length) {
      setStatus({ type: 'success', message: `Successfully saved ${successCount} records.` });
      fetchMonthlyRecords();
    } else {
      setStatus({ type: 'error', message: `Failed to save some records. (${successCount}/${modifiedDates.length} saved)` });
    }
    setSavingAll(false);
  };

  const updatePendingRecord = (date: string, field: keyof DTRRecord, value: string) => {
    setPendingRecords(prev => ({
      ...prev,
      [date]: {
        ...(prev[date] || { employee_id: Number(selectedEmployeeId), date, morning_in: '', morning_out: '', afternoon_in: '', afternoon_out: '', remarks: '' }),
        [field]: value
      }
    }));
  };

  const calculateUndertime = (record: Partial<DTRRecord>) => {
    let totalMinutes = 0;

    const parseTime = (t: string) => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    const amIn = parseTime(record.morning_in || '');
    const amOut = parseTime(record.morning_out || '');
    const pmIn = parseTime(record.afternoon_in || '');
    const pmOut = parseTime(record.afternoon_out || '');

    const employee = employees.find(e => e.id === selectedEmployeeId);
    const category = employee?.category as keyof typeof SCHEDULES;
    const schedule = SCHEDULES[category] || SCHEDULES.JHS;

    const OFF_AM_IN = parseTime(schedule.amIn)!;
    const OFF_AM_OUT = parseTime(schedule.amOut)!;
    const OFF_PM_IN = parseTime(schedule.pmIn)!;
    const OFF_PM_OUT = parseTime(schedule.pmOut)!;

    if (amIn && amIn > OFF_AM_IN) totalMinutes += (amIn - OFF_AM_IN);
    if (amOut && amOut < OFF_AM_OUT) totalMinutes += (OFF_AM_OUT - amOut);
    if (pmIn && pmIn > OFF_PM_IN) totalMinutes += (pmIn - OFF_PM_IN);
    if (pmOut && pmOut < OFF_PM_OUT) totalMinutes += (OFF_PM_OUT - pmOut);

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return { hours: hours || '', minutes: minutes || '' };
  };

  const handlePrintDTR = () => {
    if (!selectedEmployeeId) return;
    
    const employee = employees.find(e => e.id === selectedEmployeeId);
    const employeeName = employee ? employee.name : 'Employee';
    const category = employee?.category as keyof typeof SCHEDULES;
    const schedule = SCHEDULES[category] || SCHEDULES.JHS;
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let tableRows = '';
    let totalUndertimeMinutes = 0;
    days.forEach(day => {
      const record = monthlyRecords[day.date] || { morning_in: '', morning_out: '', afternoon_in: '', afternoon_out: '', remarks: '' };
      const undertime = calculateUndertime(record);
      
      const h = Number(undertime.hours) || 0;
      const m = Number(undertime.minutes) || 0;
      totalUndertimeMinutes += (h * 60) + m;

      tableRows += `
        <tr>
          <td>${day.day}</td>
          <td>${formatTo12h(record.morning_in)}</td>
          <td>${formatTo12h(record.morning_out)}</td>
          <td>${formatTo12h(record.afternoon_in)}</td>
          <td>${formatTo12h(record.afternoon_out)}</td>
          <td>${undertime.hours}</td>
          <td>${undertime.minutes}</td>
        </tr>
      `;
    });

    const totalHours = Math.floor(totalUndertimeMinutes / 60);
    const totalMins = totalUndertimeMinutes % 60;
    const totalRow = `
      <tr>
        <td colspan="5" style="text-align: right; font-weight: bold; padding-right: 10px;">TOTAL</td>
        <td style="font-weight: bold;">${totalHours || ''}</td>
        <td style="font-weight: bold;">${totalMins || ''}</td>
      </tr>
    `;

    const singleFormHtml = `
      <div class="form-instance">
        <div class="header-info">Civil Service Form No. 48</div>
        <div class="form-title">DAILY TIME RECORD</div>
        <div class="name-container">
          <div class="employee-name">${employeeName.toUpperCase()}</div>
          <div style="font-size: 8px; color: #666;">(Name)</div>
        </div>
        <div class="subtitle">For the month of <strong>${monthName} ${year}</strong></div>
        <div style="font-size: 9px; margin-bottom: 8px; line-height: 1.2;">
          Official hours for arrival { Regular days: ${schedule.label} }<br>
          and departure { Saturdays: As required }
        </div>
        <table>
          <thead>
            <tr>
              <th rowspan="2">Day</th>
              <th colspan="2">A.M.</th>
              <th colspan="2">P.M.</th>
              <th colspan="2">UNDERTIME</th>
            </tr>
            <tr>
              <th>Arrival</th>
              <th>Departure</th>
              <th>Arrival</th>
              <th>Departure</th>
              <th>Hrs</th>
              <th>Min</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            ${totalRow}
          </tbody>
        </table>
        <div class="footer-text">
          I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.
        </div>
        <div class="signature-area" style="display: block;">
          <div class="sig-box" style="width: 100%; margin-bottom: 10px;">
            <div class="sig-line">Employee Signature</div>
          </div>
          <div style="text-align: left; font-size: 8px; margin-bottom: 5px;">Verified as to the prescribed office hours:</div>
          <div class="sig-box" style="width: 100%;">
            <div class="sig-line">In Charge</div>
          </div>
        </div>
      </div>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>CS Form 48 - ${employeeName}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            * { box-sizing: border-box; }
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 0; color: #000; background: #fff; line-height: 1.1; }
            .page-container { display: flex; justify-content: space-between; gap: 5mm; width: 100%; height: 190mm; overflow: hidden; }
            .form-instance { flex: 1; border-right: 1px dashed #ccc; padding-right: 3mm; display: flex; flex-direction: column; height: 100%; }
            .form-instance:last-child { border-right: none; padding-right: 0; }
            .header-info { font-size: 7px; margin-bottom: 2px; }
            .form-title { text-align: center; font-weight: bold; font-size: 14px; margin: 2px 0; }
            .employee-name { text-align: center; font-weight: bold; font-size: 12px; border-bottom: 1px solid black; display: inline-block; width: 100%; margin-bottom: 1px; }
            .name-container { text-align: center; margin-bottom: 5px; }
            .subtitle { text-align: center; font-size: 10px; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 5px; table-layout: fixed; }
            th, td { border: 1px solid black; padding: 1px; text-align: center; font-size: 8.5px; height: 12px; overflow: hidden; white-space: nowrap; }
            th { font-weight: bold; background: #f9f9f9; }
            .footer-text { font-size: 8px; line-height: 1.2; margin-top: 8px; text-align: justify; }
            .signature-area { margin-top: 15px; display: flex; justify-content: space-between; gap: 10px; }
            .sig-box { text-align: center; width: 48%; }
            .sig-line { border-top: 1px solid black; margin-top: 25px; padding-top: 2px; font-weight: bold; font-size: 9px; }
            .no-print { position: fixed; bottom: 20px; right: 20px; z-index: 100; }
            @media print {
              .no-print { display: none; }
              .form-instance { border-right: 1px dashed #000; }
              .form-instance:last-child { border-right: none; }
            }
          </style>
        </head>
        <body>
          <div class="no-print">
            <button onclick="window.print()" style="padding: 12px 24px; cursor: pointer; background: #000; color: #fff; border: none; border-radius: 8px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">Print 3-in-1 DTR</button>
          </div>
          <div class="page-container">
            ${singleFormHtml}
            ${singleFormHtml}
            ${singleFormHtml}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportExcel = () => {
    if (!selectedEmployeeId) return;
    
    const employee = employees.find(e => e.id === selectedEmployeeId);
    const employeeName = employee ? employee.name : 'Employee';
    const category = employee?.category as keyof typeof SCHEDULES;
    const schedule = SCHEDULES[category] || SCHEDULES.JHS;
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
    
    // Create an HTML table string with borders
    let html = `
      <style>
        table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
        th, td { border: 1px solid black; padding: 4px; text-align: center; font-size: 11px; }
        .header { border: none; text-align: left; font-size: 12px; }
        .title { border: none; text-align: center; font-weight: bold; font-size: 14px; }
      </style>
      <table>
        <tr><td colspan="8" class="header">Civil Service Form 48</td></tr>
        <tr><td colspan="8" class="header"></td></tr>
        <tr><td colspan="8" class="title">DAILY TIME RECORD</td></tr>
        <tr><td colspan="8" class="title">${employeeName.toUpperCase()}</td></tr>
        <tr><td colspan="8" class="title">For the month of ${monthName} ${year}</td></tr>
        <tr><td colspan="8" class="header">Official hours for arrival (Regular days) ${schedule.label}</td></tr>
        <tr><td colspan="8" class="header">and Departure (Saturdays) "As required"</td></tr>
        <tr><td colspan="8" class="header"></td></tr>
        <thead>
          <tr>
            <th rowspan="2">Day</th>
            <th colspan="2">AM</th>
            <th colspan="2">PM</th>
            <th colspan="2">Undertime</th>
            <th rowspan="2">Remarks</th>
          </tr>
          <tr>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Hours</th>
            <th>Minutes</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    let tableRowsHtml = '';
    let totalUndertimeMinutes = 0;
    days.forEach(day => {
      const record = monthlyRecords[day.date] || { morning_in: '', morning_out: '', afternoon_in: '', afternoon_out: '', remarks: '' };
      const undertime = calculateUndertime(record);

      const h = Number(undertime.hours) || 0;
      const m = Number(undertime.minutes) || 0;
      totalUndertimeMinutes += (h * 60) + m;

      tableRowsHtml += `
        <tr>
          <td>${day.day}</td>
          <td>${formatTo12h(record.morning_in)}</td>
          <td>${formatTo12h(record.morning_out)}</td>
          <td>${formatTo12h(record.afternoon_in)}</td>
          <td>${formatTo12h(record.afternoon_out)}</td>
          <td>${undertime.hours}</td>
          <td>${undertime.minutes}</td>
          <td>${record.remarks || ''}</td>
        </tr>
      `;
    });

    const totalHours = Math.floor(totalUndertimeMinutes / 60);
    const totalMins = totalUndertimeMinutes % 60;
    const totalRowHtml = `
      <tr>
        <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL</td>
        <td style="font-weight: bold;">${totalHours || ''}</td>
        <td style="font-weight: bold;">${totalMins || ''}</td>
        <td></td>
      </tr>
    `;
    
    html += tableRowsHtml;
    html += totalRowHtml;
    
    html += `
        </tbody>
        <tr><td colspan="8" class="header"></td></tr>
        <tr><td colspan="8" class="header">I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.</td></tr>
        <tr><td colspan="8" class="header"></td></tr>
        <tr><td colspan="2"></td><td colspan="6" class="header">______________________________</td></tr>
        <tr><td colspan="2"></td><td colspan="6" class="header">Employee Signature</td></tr>
        <tr><td colspan="8" class="header"></td></tr>
        <tr><td colspan="2"></td><td colspan="6" class="header">Verified as to the prescribed office hours:</td></tr>
        <tr><td colspan="2"></td><td colspan="6" class="header">______________________________</td></tr>
        <tr><td colspan="2"></td><td colspan="6" class="header">In Charge</td></tr>
      </table>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CS_Form_48_${employeeName.replace(/[^a-z0-9]/gi, '_')}_${monthName}_${year}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m, 0).getDate();
  };

  const days = Array.from({ length: getDaysInMonth(year, month) }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    const dateObj = new Date(year, month - 1, d);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
    return { date: dateStr, day: d, dayName };
  });

  const hasChanges = Object.keys(pendingRecords).some(date => {
    const pending = pendingRecords[date];
    const original = monthlyRecords[date] || { morning_in: '', morning_out: '', afternoon_in: '', afternoon_out: '', remarks: '' };
    return pending.morning_in !== (original.morning_in || '') ||
           pending.morning_out !== (original.morning_out || '') ||
           pending.afternoon_in !== (original.afternoon_in || '') ||
           pending.afternoon_out !== (original.afternoon_out || '') ||
           pending.remarks !== (original.remarks || '');
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-lg shadow-2xl border border-blue-100 w-full max-w-md"
        >
          <div className="text-center mb-10">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-32 h-32 mx-auto mb-8"
            >
              <img 
                src="https://i.imgur.com/dwb4CVP.png" 
                alt="Guinsiliban NHS Logo" 
                className="w-full h-full object-contain drop-shadow-xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Guinsiliban NHS</h1>
            <div className="h-1 w-16 bg-[#1877F2] mx-auto my-4"></div>
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.3em]">DTR Management System</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <User className="w-3 h-3 text-[#1877F2]" /> Username
              </label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full bg-blue-50/30 border border-blue-100 rounded px-4 py-3 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Lock className="w-3 h-3 text-[#1877F2]" /> Password
              </label>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-blue-50/30 border border-blue-100 rounded px-4 py-3 text-sm focus:ring-1 focus:ring-blue-400 focus:border-blue-400 outline-none transition-all"
              />
            </div>

            {loginError && (
              <div className="bg-red-50 text-red-600 p-3 rounded text-xs font-medium border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white text-xs font-bold uppercase tracking-widest py-4 rounded transition-all shadow-lg"
            >
              Sign In
            </button>
          </form>

          <div className="mt-10 pt-6 border-t border-blue-50 text-center">
            <p className="text-[10px] text-blue-300 font-mono leading-relaxed">
              Guinsiliban National High School<br/>
              Daily Time Record System
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 font-sans p-4 md:p-10">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-blue-200 pb-10">
          <div className="space-y-1">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20">
                <img 
                  src="https://i.imgur.com/dwb4CVP.png" 
                  alt="Guinsiliban NHS Logo" 
                  className="w-full h-full object-contain drop-shadow-md"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase leading-none">Guinsiliban NHS</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">
                    {user.role === 'admin' ? 'Administrative Control' : user.role === 'developer' ? 'Developer Access' : 'Employee Portal'}
                  </span>
                  <div className="h-1 w-1 rounded-full bg-blue-200"></div>
                  <span className="text-xs font-medium text-slate-500">User: {user.name}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {(user.role === 'admin' || user.role === 'developer') && (
              <div className="flex items-center bg-white rounded-lg border border-blue-100 p-1 shadow-sm mr-4">
                <button 
                  onClick={() => setView('dtr')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'dtr' ? 'bg-[#1877F2] text-white shadow-md' : 'text-slate-500 hover:bg-blue-50/50'}`}
                >
                  <History className="w-3.5 h-3.5" />
                  DTR View
                </button>
                <button 
                  onClick={() => setView('stats')}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'stats' ? 'bg-[#1877F2] text-white shadow-md' : 'text-slate-500 hover:bg-blue-50/50'}`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  Statistics
                </button>
                {user.role === 'developer' && (
                  <button 
                    onClick={() => setView('developer')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${view === 'developer' ? 'bg-[#1877F2] text-white shadow-md' : 'text-slate-500 hover:bg-blue-50/50'}`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Credentials
                  </button>
                )}
              </div>
            )}

            {(user.role === 'admin' || user.role === 'developer') && (
              <button 
                onClick={() => setShowAddPersonnelModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Personnel
              </button>
            )}

            {(user.role === 'admin' || user.role === 'developer') && view === 'dtr' && (
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'JHS', label: 'JHS Teaching' },
                  { id: 'SHS', label: 'SHS Teaching' },
                  { id: 'NON_TEACHING', label: 'Non-Teaching' }
                ].map((cat) => (
                  <div key={cat.id} className="relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === cat.id ? null : cat.id as any)}
                      className={`flex items-center gap-2 px-3 py-2 rounded border shadow-sm transition-all text-left min-w-[180px] ${
                        employees.find(e => e.id === selectedEmployeeId)?.category === cat.id 
                          ? 'bg-[#1877F2] border-[#1877F2] text-white' 
                          : 'bg-white border-blue-100 text-slate-700 hover:border-blue-200'
                      }`}
                    >
                      <User className={`w-3 h-3 ${employees.find(e => e.id === selectedEmployeeId)?.category === cat.id ? 'text-blue-200' : 'text-blue-400'}`} />
                      <span className="flex-1 text-[10px] font-bold uppercase tracking-wider truncate">
                        {employees.find(e => e.id === selectedEmployeeId)?.category === cat.id 
                          ? employees.find(e => e.id === selectedEmployeeId)?.name 
                          : cat.label}
                      </span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${activeDropdown === cat.id ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                      {activeDropdown === cat.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setActiveDropdown(null)}
                          />
                          <motion.div 
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute top-full left-0 mt-2 w-[280px] bg-white border border-blue-100 rounded shadow-xl z-50 overflow-hidden"
                          >
                            <div className="p-2 border-b border-blue-50 bg-blue-50/30">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-blue-400" />
                                <input 
                                  type="text"
                                  placeholder={`Search ${cat.label}...`}
                                  value={employeeSearch}
                                  onChange={(e) => setEmployeeSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-[10px] bg-white border border-blue-100 rounded focus:ring-1 focus:ring-blue-400 outline-none"
                                  autoFocus
                                />
                              </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto py-1 custom-scrollbar">
                              {employees
                                .filter(e => e.role !== 'admin' && e.category === cat.id)
                                .filter(e => e.name.toLowerCase().includes(employeeSearch.toLowerCase()))
                                .map(emp => (
                                  <button
                                    key={emp.id}
                                    onClick={() => {
                                      setSelectedEmployeeId(emp.id);
                                      setActiveDropdown(null);
                                      setEmployeeSearch('');
                                    }}
                                    className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wider hover:bg-blue-50 transition-colors ${
                                      selectedEmployeeId === emp.id ? 'text-[#1877F2] bg-blue-50/50' : 'text-slate-600'
                                    }`}
                                  >
                                    {emp.name}
                                  </button>
                                ))}
                              {employees.filter(e => e.role !== 'admin' && e.category === cat.id && e.name.toLowerCase().includes(employeeSearch.toLowerCase())).length === 0 && (
                                <div className="px-4 py-6 text-center">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">No matches</span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded border border-blue-100 shadow-sm">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <select 
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <div className="w-px h-3 bg-blue-100"></div>
              <select 
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent border-none focus:ring-0 text-xs font-bold uppercase tracking-wider text-slate-700 cursor-pointer outline-none"
              >
                {[2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

              <div className="flex items-center gap-2">
              {(user.role === 'admin' || user.role === 'developer') && selectedEmployeeId && (
                <>
                  <button 
                    onClick={handlePrintDTR}
                    className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded shadow-sm transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-bold text-[10px] uppercase tracking-widest">Print DTR</span>
                  </button>
                  <button 
                    onClick={handleExportExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow-sm transition-all flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span className="font-bold text-[10px] uppercase tracking-widest">Export Excel</span>
                  </button>
                </>
              )}
              
              <button 
                onClick={handleLogout}
                className="bg-white p-2 rounded border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 transition-all shadow-sm"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main>
          {view === 'developer' && user.role === 'developer' ? (
            <DeveloperView 
              employees={employees}
              onUpdate={fetchEmployees}
              userId={user.id}
            />
          ) : view === 'stats' && (user.role === 'admin' || user.role === 'developer') ? (
            <StatsDashboard 
              data={calculateStats()} 
              monthName={new Date(year, month - 1).toLocaleString('default', { month: 'long' })}
              year={year}
            />
          ) : !selectedEmployeeId ? (
            <div className="bg-white rounded border border-blue-100 p-20 text-center shadow-sm">
              <User className="w-10 h-10 text-blue-100 mx-auto mb-6" />
              <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-blue-300">System Ready — Select Employee to Begin</h2>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded border border-blue-100 shadow-sm overflow-hidden"
            >
              <div className="px-8 py-5 border-b border-blue-50 bg-blue-50/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Employee Record</span>
                    <span className="text-sm font-bold text-slate-900 uppercase">
                      {employees.find(e => e.id === selectedEmployeeId)?.name}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-blue-100"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Period</span>
                    <span className="text-sm font-bold text-slate-900 uppercase">
                      {new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 rounded text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    <History className="w-3 h-3" />
                    System Log
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-blue-50/30 border-b border-blue-100">
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 w-24">Day</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center border-x border-blue-50" colSpan={2}>AM</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center border-x border-blue-50" colSpan={2}>PM</th>
                      <th className="px-4 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center border-x border-blue-50" colSpan={2}>Undertime</th>
                      <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Remarks</th>
                    </tr>
                    <tr className="bg-blue-50/10 border-b border-blue-100">
                      <th className="px-8 py-2 text-[9px] font-bold uppercase text-blue-400">Date</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-l border-blue-50">Arrival</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-r border-blue-50">Departure</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-l border-blue-50">Arrival</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-r border-blue-50">Departure</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-l border-blue-50">Hours</th>
                      <th className="px-2 py-2 text-[9px] font-bold uppercase text-blue-400 text-center border-r border-blue-50">Minutes</th>
                      <th className="px-8 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50">
                    {days.map((day) => {
                      const record = pendingRecords[day.date] || {
                        morning_in: '',
                        morning_out: '',
                        afternoon_in: '',
                        afternoon_out: '',
                        remarks: ''
                      };
                      const original = monthlyRecords[day.date] || {
                        morning_in: '',
                        morning_out: '',
                        afternoon_in: '',
                        afternoon_out: '',
                        remarks: ''
                      };
                      const isWeekend = day.dayName === 'Saturday' || day.dayName === 'Sunday';
                      
                      const undertime = calculateUndertime(record);

                      return (
                        <DayRow 
                          key={day.date} 
                          day={day} 
                          record={record}
                          original={original}
                          isWeekend={isWeekend}
                          undertime={undertime}
                          onUpdate={(field, val) => updatePendingRecord(day.date, field, val)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="px-8 py-6 bg-blue-50/30 border-t border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <AnimatePresence>
                    {status && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className={`px-4 py-2 rounded flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${status.type === 'success' ? 'bg-blue-100 text-[#1877F2] border border-blue-200' : 'bg-red-100 text-red-700 border border-red-200'}`}
                      >
                        {status.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {status.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {!status && hasChanges && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 uppercase tracking-widest animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                      Unsaved Changes Detected
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleSaveAll}
                  disabled={!hasChanges || savingAll}
                  className={`flex items-center gap-3 px-10 py-4 rounded text-xs font-bold uppercase tracking-[0.2em] transition-all ${hasChanges ? 'bg-[#1877F2] text-white hover:bg-[#166FE5] shadow-xl' : 'bg-blue-100 text-blue-300 cursor-not-allowed'}`}
                >
                  {savingAll ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Commit Changes
                </button>
              </div>
            </motion.div>
          )}
        </main>

        {/* Footer */}
        <footer className="text-center py-10 border-t border-blue-200">
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2 text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Secure Systematic Ledger • Guinsiliban NHS</span>
            </div>
            <p className="text-[9px] text-blue-200 font-mono">SYSTEM_ID: GNHS-DTR-2026-V1.2 • ALL LOGS ARE AUDITED</p>
          </div>
        </footer>
      </div>

      <AnimatePresence>
        {showAddPersonnelModal && (
          <AddPersonnelModal 
            onClose={() => setShowAddPersonnelModal(false)}
            onSuccess={() => {
              fetchEmployees();
              setShowAddPersonnelModal(false);
            }}
            userId={user.id}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const AddPersonnelModal: React.FC<{ onClose: () => void, onSuccess: () => void, userId: number }> = ({ onClose, onSuccess, userId }) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'JHS' | 'SHS' | 'NON_TEACHING'>('JHS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/employees/add', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId.toString()
        },
        body: JSON.stringify({ name, category })
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json() as any;
        setError(data.error || 'Failed to add personnel');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-blue-900/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-blue-50 bg-blue-50/30">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Add New Personnel</h3>
          <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider mt-1">Register a new employee to the system</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Full Name (Last Name, First Name)</label>
            <input 
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dela Cruz, Juan"
              className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-900/10 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Department / Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-3 bg-blue-50/30 border border-blue-100 rounded-lg text-xs font-bold uppercase tracking-widest focus:ring-2 focus:ring-blue-900/10 focus:border-blue-500 outline-none transition-all"
            >
              <option value="JHS">JHS Teaching</option>
              <option value="SHS">SHS Teaching</option>
              <option value="NON_TEACHING">Non-Teaching</option>
            </select>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
              <span className="font-bold">Note:</span> Username will be auto-generated from the <span className="font-bold">first name</span> (e.g. "Juan"). Default password is <span className="font-bold">303991</span>.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase tracking-widest rounded flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-blue-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-50 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#1877F2] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#166FE5] transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              Register
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

interface DayRowProps {
  day: { date: string; day: number; dayName: string };
  record: DTRRecord;
  original: DTRRecord;
  isWeekend: boolean;
  undertime: { hours: number | string; minutes: number | string };
  onUpdate: (field: keyof DTRRecord, val: string) => void;
}

const DayRow: React.FC<DayRowProps> = ({ day, record, original, isWeekend, undertime, onUpdate }) => {
  const isModified = record.morning_in !== (original.morning_in || '') ||
                    record.morning_out !== (original.morning_out || '') ||
                    record.afternoon_in !== (original.afternoon_in || '') ||
                    record.afternoon_out !== (original.afternoon_out || '') ||
                    record.remarks !== (original.remarks || '');

  return (
    <tr className={`data-grid-row ${isWeekend ? 'bg-blue-50/30' : ''} ${isModified ? 'bg-amber-50/50' : ''}`}>
      <td className="px-8 py-3">
        <div className="flex flex-col">
          <span className={`text-sm font-bold ${isWeekend ? 'text-blue-300' : 'text-slate-700'}`}>{day.day}</span>
          <span className={`text-[9px] font-bold uppercase tracking-widest ${isWeekend ? 'text-blue-400' : 'text-blue-400'}`}>
            {day.dayName}
          </span>
        </div>
      </td>
      <td className="px-2 py-3 border-l border-blue-50">
        <div className="flex justify-center">
          <input 
            type="time" 
            value={record.morning_in || ''}
            onChange={(e) => onUpdate('morning_in', e.target.value)}
            className={`input-time text-center w-24 ${isWeekend ? 'opacity-40' : ''}`}
          />
        </div>
      </td>
      <td className="px-2 py-3 border-r border-blue-50">
        <div className="flex justify-center">
          <input 
            type="time" 
            value={record.morning_out || ''}
            onChange={(e) => onUpdate('morning_out', e.target.value)}
            className={`input-time text-center w-24 ${isWeekend ? 'opacity-40' : ''}`}
          />
        </div>
      </td>
      <td className="px-2 py-3 border-l border-blue-50">
        <div className="flex justify-center">
          <input 
            type="time" 
            value={record.afternoon_in || ''}
            onChange={(e) => onUpdate('afternoon_in', e.target.value)}
            className={`input-time text-center w-24 ${isWeekend ? 'opacity-40' : ''}`}
          />
        </div>
      </td>
      <td className="px-2 py-3 border-r border-blue-50">
        <div className="flex justify-center">
          <input 
            type="time" 
            value={record.afternoon_out || ''}
            onChange={(e) => onUpdate('afternoon_out', e.target.value)}
            className={`input-time text-center w-24 ${isWeekend ? 'opacity-40' : ''}`}
          />
        </div>
      </td>
      <td className="px-2 py-3 border-l border-slate-50 text-center font-mono text-xs text-slate-500">
        {undertime.hours}
      </td>
      <td className="px-2 py-3 border-r border-slate-50 text-center font-mono text-xs text-slate-500">
        {undertime.minutes}
      </td>
      <td className="px-8 py-3">
        <input 
          type="text" 
          value={record.remarks || ''}
          onChange={(e) => onUpdate('remarks', e.target.value)}
          placeholder="Notes..."
          className={`w-full bg-white border border-slate-200 rounded px-3 py-1.5 text-xs font-medium focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none transition-all ${isWeekend ? 'opacity-40' : ''}`}
        />
      </td>
    </tr>
  );
};

const StatsDashboard: React.FC<{ data: any[], monthName: string, year: number }> = ({ data, monthName, year }) => {
  const sortedByLates = [...data].sort((a, b) => b.lates - a.lates).slice(0, 10);
  const sortedByAbsences = [...data].sort((a, b) => b.absences - a.absences).slice(0, 10);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lates Chart */}
        <div className="bg-white p-8 rounded border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Top 10 Most Late (Minutes)
              </h3>
              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">{monthName} {year}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-blue-100" />
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedByLates} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eff6ff" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#1877F2' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f0f9ff' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 700 }}
                />
                <Bar dataKey="lates" radius={[0, 4, 4, 0]} barSize={20}>
                  {sortedByLates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#1877F2' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Absences Chart */}
        <div className="bg-white p-8 rounded border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Top 10 Most Absences (Days)
              </h3>
              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">{monthName} {year}</p>
            </div>
            <PieChartIcon className="w-5 h-5 text-blue-100" />
          </div>

          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sortedByAbsences} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eff6ff" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={120} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#1877F2' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  cursor={{ fill: '#f0f9ff' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '10px', fontWeight: 700 }}
                />
                <Bar dataKey="absences" radius={[0, 4, 4, 0]} barSize={20}>
                  {sortedByAbsences.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#1877F2' : '#60a5fa'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-900">Full Monthly Performance Ledger</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500"></div>
              <span className="text-[9px] font-bold uppercase text-slate-400">Late Threshold</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-[9px] font-bold uppercase text-slate-400">Absence Alert</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Personnel Name</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Category</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Total Late (Mins)</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Total Absences</th>
                <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Performance Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sort((a, b) => (b.lates + b.absences * 60) - (a.lates + a.absences * 60)).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-4">
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{row.name}</span>
                  </td>
                  <td className="px-8 py-4">
                    <span className="text-[9px] font-bold uppercase px-2 py-1 rounded bg-slate-100 text-slate-500 tracking-widest border border-slate-200">
                      {row.category}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className={`text-xs font-mono font-bold ${row.lates > 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                      {row.lates}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className={`text-xs font-mono font-bold ${row.absences > 2 ? 'text-red-600' : 'text-slate-600'}`}>
                      {row.absences}
                    </span>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${row.absences > 3 || row.lates > 120 ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(5, 100 - (row.absences * 10 + row.lates / 10))}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {Math.max(0, 100 - (row.absences * 10 + row.lates / 10)).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

const DeveloperView: React.FC<{ employees: Employee[], onUpdate: () => void, userId: number }> = ({ employees, onUpdate, userId }) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handleUpdate = async (empId: number) => {
    if (!newUsername || !newPassword) return;
    setLoading(true);
    try {
      const res = await fetch('/api/employees/update-credentials', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId.toString()
        },
        body: JSON.stringify({ employeeId: empId, newUsername, newPassword })
      });
      if (res.ok) {
        setStatus({ type: 'success', message: 'Credentials updated successfully' });
        setEditingId(null);
        onUpdate();
      } else {
        const data = await res.json() as any;
        setStatus({ type: 'error', message: data.error || 'Failed to update credentials' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error' });
    } finally {
      setLoading(false);
      setTimeout(() => setStatus(null), 3000);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded border border-blue-100 shadow-sm overflow-hidden"
    >
      <div className="px-8 py-6 border-b border-blue-50 bg-blue-50/30 flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-900">Credential Management</h3>
          <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">Developer Tool — System Access Control</p>
        </div>
        {status && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
              status.type === 'success' ? 'bg-blue-50 text-[#1877F2] border border-blue-100' : 'bg-red-50 text-red-600 border border-red-100'
            }`}
          >
            {status.type === 'success' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
            {status.message}
          </motion.div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-blue-50/30 border-b border-blue-100">
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Role</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Username</th>
              <th className="px-8 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-50">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-blue-50 transition-colors">
                <td className="px-8 py-4">
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">{emp.name}</span>
                </td>
                <td className="px-8 py-4">
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded tracking-widest border ${
                    emp.role === 'admin' ? 'bg-[#1877F2] text-white border-[#1877F2]' : 
                    emp.role === 'developer' ? 'bg-blue-600 text-white border-blue-600' : 
                    'bg-blue-50 text-blue-400 border-blue-100'
                  }`}>
                    {emp.role}
                  </span>
                </td>
                <td className="px-8 py-4">
                  {editingId === emp.id ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="New Username"
                        className="px-2 py-1 text-[10px] bg-white border border-blue-100 rounded outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <input 
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        className="px-2 py-1 text-[10px] bg-white border border-blue-100 rounded outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-slate-500">{emp.username}</span>
                  )}
                </td>
                <td className="px-8 py-4 text-right">
                  {editingId === emp.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleUpdate(emp.id)}
                        disabled={loading}
                        className="p-1.5 bg-[#1877F2] text-white rounded hover:bg-[#166FE5] transition-colors"
                        title="Save"
                      >
                        <Save className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        className="p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                        title="Cancel"
                      >
                        <Plus className="w-3.5 h-3.5 rotate-45" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setEditingId(emp.id);
                        setNewUsername(emp.username || '');
                        setNewPassword('');
                      }}
                      className="text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                    >
                      Reset Credentials
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
