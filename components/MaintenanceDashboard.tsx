import React, { useState, useMemo } from 'react';
import { MaintenanceTicket, Operator, Ride } from '../types';
import { database } from '../firebaseConfig';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Users, 
  UserCheck, 
  Search, 
  Plus, 
  Trash2, 
  Check, 
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Filter,
  UserPlus,
  RefreshCw,
  Sparkles,
  Layers,
  Camera,
  Image as ImageIcon,
  Maximize2,
  X,
  Download,
  UploadCloud,
  FileImage,
  RotateCcw,
  HeartHandshake,
  Gamepad2,
  MessageSquare,
  Tag,
  Flame,
  User,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  FileText
} from 'lucide-react';

// Client-side image compression helper: keeps size tiny (< 40KB) via HTML5 Canvas
export const compressImageToLightweightDataUrl = (
  file: File | Blob,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.72
): Promise<{ dataUrl: string; sizeKb: number; originalSizeKb: number }> => {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Proportional scale to fit within maxWidth x maxHeight
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to lightweight JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
        resolve({ dataUrl, sizeKb, originalSizeKb });
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

const CX_FEEDBACK_CATEGORIES = [
  'Guest Comfort & Seating',
  'Ride Smoothness & Noise',
  'Safety Harness & Restraints',
  'Audio, Video & Light FX',
  'Air Conditioning & Ventilation',
  'Cleanliness & Sanitation',
  'Queue Line & Signage',
  'Mechanical / Operational Issue',
  'General Guest Feedback'
];

interface Props {
  maintenanceTickets: Record<string, Record<string, MaintenanceTicket>> | Record<string, any>;
  selectedDate: string;
  onDateChange: (date: string) => void;
  onUpdateTicketStatus: (
    ticket: MaintenanceTicket, 
    status: 'in-progress' | 'solved' | 'reported', 
    technician?: Operator, 
    helpers?: Operator[],
    notes?: string,
    solutionImageUrl?: string
  ) => void;
  maintenancePersonnel: Operator[];
  onClearSolved: (date: string) => void;
  rides?: Ride[];
  onReportProblem?: (
    rideId: number, 
    problem: string,
    feedbackCategory?: string,
    priority?: 'normal' | 'high' | 'urgent',
    guestDetails?: string,
    source?: string
  ) => void;
  portalType?: 'rides' | 'cx' | 'all';
  role?: string;
  onSwitchPortal?: (portal: 'rides' | 'cx') => void;
}

export const MaintenanceDashboard: React.FC<Props> = ({ 
  maintenanceTickets = {}, 
  selectedDate, 
  onDateChange, 
  onUpdateTicketStatus, 
  maintenancePersonnel = [], 
  onClearSolved,
  rides = [],
  onReportProblem,
  portalType = 'rides',
  role = 'maintenance',
  onSwitchPortal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewScope, setViewScope] = useState<'unresolved' | 'solved' | 'date' | 'all'>('unresolved');
  const [selectedStatusTab, setSelectedStatusTab] = useState<'all' | 'reported' | 'in-progress' | 'solved'>('all');
  const [selectedTechsByTicket, setSelectedTechsByTicket] = useState<Record<string, number[]>>({});
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [resolutionNotesByTicket, setResolutionNotesByTicket] = useState<Record<string, string>>({});
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicketRideId, setNewTicketRideId] = useState<number | ''>('');
  const [newTicketProblem, setNewTicketProblem] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState<string>(
    portalType === 'cx' ? 'Guest Comfort & Seating' : 'Operational Issue'
  );
  const [newTicketPriority, setNewTicketPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [newTicketGuestDetails, setNewTicketGuestDetails] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  // Photo attachment states
  const [photoByTicket, setPhotoByTicket] = useState<Record<string, { dataUrl: string; sizeKb: number; originalSizeKb?: number }>>({});
  const [isCompressingTicketId, setIsCompressingTicketId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    rideName: string;
    problem: string;
    resolutionNotes?: string;
    date?: string;
    techNames?: string[];
  } | null>(null);

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const isCxTicket = (t: MaintenanceTicket) => {
    return t.source === 'cx' || 
      t.reportedByRole?.toLowerCase().includes('cx') || 
      t.reportedByRole?.toLowerCase().includes('customer experience');
  };

  // Collect all tickets across all dates
  const allTicketsFlat = useMemo(() => {
    const list: MaintenanceTicket[] = [];
    if (!maintenanceTickets || typeof maintenanceTickets !== 'object') return list;
    Object.keys(maintenanceTickets).forEach(dateKey => {
      const dateTickets = maintenanceTickets[dateKey];
      if (dateTickets && typeof dateTickets === 'object') {
        Object.values(dateTickets).forEach(t => {
          const ticketObj = t as any;
          if (ticketObj && typeof ticketObj === 'object' && ticketObj.id) {
            list.push(ticketObj as MaintenanceTicket);
          }
        });
      }
    });
    // Sort newest reports first
    return list.sort((a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime());
  }, [maintenanceTickets]);

  // Base tickets filtered for current portal (Games & Ride Associates vs CX)
  const baseTickets = useMemo(() => {
    if (portalType === 'cx') {
      return allTicketsFlat.filter(t => isCxTicket(t));
    } else if (portalType === 'rides') {
      return allTicketsFlat.filter(t => !isCxTicket(t));
    }
    return allTicketsFlat;
  }, [allTicketsFlat, portalType]);

  // Global solved tickets across all portals
  const allSolvedTicketsFlat = useMemo(() => {
    return allTicketsFlat.filter(t => t.status === 'solved');
  }, [allTicketsFlat]);

  // Global CX tickets across all states
  const allCxTicketsFlat = useMemo(() => {
    return allTicketsFlat.filter(t => isCxTicket(t));
  }, [allTicketsFlat]);

  // Global solved CX tickets
  const allCxSolvedTicketsFlat = useMemo(() => {
    return allTicketsFlat.filter(t => isCxTicket(t) && t.status === 'solved');
  }, [allTicketsFlat]);

  // Global counts for both tabs
  const ridesUnresolvedCount = useMemo(() => {
    return allTicketsFlat.filter(t => !isCxTicket(t) && (t.status === 'reported' || t.status === 'in-progress')).length;
  }, [allTicketsFlat]);

  const cxUnresolvedCount = useMemo(() => {
    return allTicketsFlat.filter(t => isCxTicket(t) && (t.status === 'reported' || t.status === 'in-progress')).length;
  }, [allTicketsFlat]);

  // Total unresolved count for current portal
  const totalUnresolvedCount = useMemo(() => {
    return baseTickets.filter(t => t.status === 'reported' || t.status === 'in-progress').length;
  }, [baseTickets]);

  // Total solved count for current portal
  const totalSolvedCount = useMemo(() => {
    return baseTickets.filter(t => t.status === 'solved').length;
  }, [baseTickets]);

  // Total solved with photos count
  const totalSolvedWithPhotosCount = useMemo(() => {
    return baseTickets.filter(t => t.status === 'solved' && (t.solutionImageUrl || t.photoUrl)).length;
  }, [baseTickets]);

  // Solved today count
  const solvedTodayCount = useMemo(() => {
    return baseTickets.filter(t => t.status === 'solved' && (t.date === todayStr || t.solvedAt?.startsWith(todayStr))).length;
  }, [baseTickets, todayStr]);

  // Helper to format turnaround / fix duration
  const formatTurnaroundDuration = (reportedAt?: string, solvedAt?: string) => {
    if (!reportedAt || !solvedAt) return null;
    const start = new Date(reportedAt).getTime();
    const end = new Date(solvedAt).getTime();
    const diffMs = end - start;
    if (diffMs <= 0 || isNaN(diffMs)) return null;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    if (totalMinutes < 60) {
      return `${totalMinutes} min${totalMinutes === 1 ? '' : 's'}`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (mins === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
    return `${hours}h ${mins}m`;
  };

  // --- Export and Download Utilities ---
  const downloadTicketsCSV = (ticketsToExport: MaintenanceTicket[], defaultFileName: string) => {
    if (!ticketsToExport || ticketsToExport.length === 0) {
      alert('No tickets available to download for the selected filter.');
      return;
    }

    const headers = [
      'Ticket ID',
      'Date',
      'Source Portal',
      'Ride / Attraction',
      'Floor / Location',
      'Issue / Feedback Category',
      'Priority',
      'Reported Problem / Guest Feedback',
      'Guest / Cabin Details',
      'Status',
      'Reported By',
      'Reported Role',
      'Reported At',
      'Resolved At',
      'Fix Turnaround Time',
      'Primary Technician',
      'Helper Technicians',
      'Resolution Notes / Actions Taken',
      'Proof Photo Attached'
    ];

    const rows = ticketsToExport.map(t => {
      const isFromCX = isCxTicket(t);
      const helpers = (t.helperNames && Array.isArray(t.helperNames)) ? t.helperNames.join('; ') : '';
      const turnaround = formatTurnaroundDuration(t.reportedAt, t.solvedAt) || 'N/A';
      const hasPhoto = Boolean(t.solutionImageUrl || t.photoUrl) ? 'YES' : 'NO';

      const rideObj = rides.find(r => r.id === t.rideId);
      const floorStr = rideObj?.floor || (t as any).floor || '';

      return [
        t.id || '',
        t.date || '',
        isFromCX ? 'Customer Experience (CX)' : 'Games & Ride Associate',
        t.rideName || '',
        floorStr,
        t.feedbackCategory || (isFromCX ? 'Guest Feedback' : 'Operational Issue'),
        (t.priority || 'normal').toUpperCase(),
        t.problem || '',
        t.guestDetails || '',
        (t.status || 'reported').toUpperCase(),
        t.reportedByName || '',
        t.reportedByRole || (isFromCX ? 'Customer Experience' : 'Associate'),
        t.reportedAt ? new Date(t.reportedAt).toLocaleString() : '',
        t.solvedAt ? new Date(t.solvedAt).toLocaleString() : '',
        turnaround,
        t.assignedToName || '',
        helpers,
        t.resolutionNotes || '',
        hasPhoto
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${defaultFileName}_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowDownloadMenu(false);
  };

  const handlePrintAuditReport = (ticketsToExport: MaintenanceTicket[], reportTitle: string, reportSubtitle: string) => {
    if (!ticketsToExport || ticketsToExport.length === 0) {
      alert('No tickets available to print.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups in your browser to print the audit report.');
      return;
    }

    const solvedCount = ticketsToExport.filter(t => t.status === 'solved').length;
    const activeCount = ticketsToExport.filter(t => t.status === 'reported' || t.status === 'in-progress').length;
    const withPhotoCount = ticketsToExport.filter(t => Boolean(t.solutionImageUrl || t.photoUrl)).length;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle} - ${todayStr}</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .no-print { display: none !important; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              margin: 20px;
              font-size: 11px;
            }
            .header {
              border-bottom: 2px solid #374151;
              padding-bottom: 12px;
              margin-bottom: 16px;
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .title { font-size: 18px; font-weight: bold; color: #111827; margin: 0 0 4px 0; }
            .subtitle { font-size: 12px; color: #4B5563; margin: 0; }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            .stat-card {
              border: 1px solid #E5E7EB;
              border-radius: 6px;
              padding: 8px 12px;
              background-color: #F9FAFB;
            }
            .stat-num { font-size: 16px; font-weight: bold; color: #111827; }
            .stat-lbl { font-size: 10px; color: #6B7280; text-transform: uppercase; font-weight: 600; }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #F3F4F6;
              border: 1px solid #D1D5DB;
              padding: 6px 8px;
              text-align: left;
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              color: #374151;
            }
            td {
              border: 1px solid #E5E7EB;
              padding: 6px 8px;
              vertical-align: top;
            }
            tr:nth-child(even) { background-color: #F9FAFB; }
            .badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .badge-solved { background-color: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; }
            .badge-progress { background-color: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
            .badge-reported { background-color: #FEE2E2; color: #991B1B; border: 1px solid #FECACA; }
            .badge-cx { background-color: #FCE7F3; color: #9D174D; border: 1px solid #FBCFE8; }
            .badge-op { background-color: #DBEAFE; color: #1E40AF; border: 1px solid #BFDBFE; }
            .footer {
              margin-top: 24px;
              border-top: 1px solid #E5E7EB;
              padding-top: 8px;
              font-size: 10px;
              color: #6B7280;
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <div class="no-print" style="margin-bottom: 15px; text-align: right;">
            <button onclick="window.print()" style="padding: 8px 16px; background: #2563EB; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              Print / Save as PDF
            </button>
            <button onclick="window.close()" style="margin-left: 8px; padding: 8px 16px; background: #6B7280; color: white; border: none; border-radius: 6px; cursor: pointer;">
              Close Window
            </button>
          </div>

          <div class="header">
            <div>
              <h1 class="title">${reportTitle}</h1>
              <p class="subtitle">${reportSubtitle}</p>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #374151;">Generated: ${new Date().toLocaleString()}</div>
              <div style="color: #6B7280; font-size: 10px;">Selected Date: ${selectedDate}</div>
            </div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-num">${ticketsToExport.length}</div>
              <div class="stat-lbl">Total Records</div>
            </div>
            <div class="stat-card">
              <div class="stat-num" style="color: #059669;">${solvedCount}</div>
              <div class="stat-lbl">Resolved Issues</div>
            </div>
            <div class="stat-card">
              <div class="stat-num" style="color: #D97706;">${activeCount}</div>
              <div class="stat-lbl">Active / In-Progress</div>
            </div>
            <div class="stat-card">
              <div class="stat-num" style="color: #7C3AED;">${withPhotoCount}</div>
              <div class="stat-lbl">Photo Proof Verified</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 45px;">Date</th>
                <th style="width: 70px;">Source</th>
                <th style="width: 100px;">Ride / Attraction</th>
                <th style="width: 80px;">Category</th>
                <th>Issue / Feedback</th>
                <th style="width: 65px;">Status</th>
                <th style="width: 110px;">Technicians & Helpers</th>
                <th style="width: 65px;">Turnaround</th>
                <th>Resolution Notes</th>
              </tr>
            </thead>
            <tbody>
              ${ticketsToExport.map(t => {
                const isFromCX = isCxTicket(t);
                const techList = [t.assignedToName, ...(t.helperNames || [])].filter(Boolean).join(', ');
                const statusBadge = t.status === 'solved' 
                  ? '<span class="badge badge-solved">Solved</span>'
                  : t.status === 'in-progress'
                  ? '<span class="badge badge-progress">In Progress</span>'
                  : '<span class="badge badge-reported">Reported</span>';
                const sourceBadge = isFromCX
                  ? '<span class="badge badge-cx">CX</span>'
                  : '<span class="badge badge-op">Associate</span>';
                const turnaround = formatTurnaroundDuration(t.reportedAt, t.solvedAt) || '-';

                return `
                  <tr>
                    <td>${t.date || '-'}</td>
                    <td>${sourceBadge}</td>
                    <td><strong>${t.rideName || '-'}</strong></td>
                    <td><span style="font-size: 9px; color: #4B5563;">${t.feedbackCategory || '-'}</span></td>
                    <td>
                      <div>${t.problem || '-'}</div>
                      ${t.guestDetails ? `<div style="font-size: 9px; color: #DB2777; margin-top: 2px;">Guest/Seat: ${t.guestDetails}</div>` : ''}
                    </td>
                    <td>${statusBadge}</td>
                    <td><span style="font-weight: 500;">${techList || '<em style="color:#9CA3AF;">Unassigned</em>'}</span></td>
                    <td><span style="font-family: monospace; font-size: 9px;">${turnaround}</span></td>
                    <td>
                      <div style="color: #065F46; font-size: 9.5px;">${t.resolutionNotes || '<em style="color:#9CA3AF;">No notes</em>'}</div>
                      ${t.solutionImageUrl || t.photoUrl ? '<div style="color: #059669; font-size: 9px; font-weight: bold; margin-top: 2px;">📷 Photo Verified</div>' : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Toggi Fun World • Maintenance &amp; Customer Experience Audit Log</span>
            <span>Page 1 of 1 • System Export</span>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setShowDownloadMenu(false);
  };

  // Extract tickets according to viewScope & portalType
  const scopedTickets = useMemo(() => {
    if (viewScope === 'unresolved') {
      if (selectedStatusTab === 'solved') {
        return baseTickets.filter(t => t.status === 'solved');
      }
      return baseTickets.filter(t => t.status === 'reported' || t.status === 'in-progress');
    }
    if (viewScope === 'solved') {
      return baseTickets.filter(t => t.status === 'solved');
    }
    if (viewScope === 'all') {
      return baseTickets;
    }
    // viewScope === 'date'
    if (!maintenanceTickets[selectedDate]) return [];
    return (Object.values(maintenanceTickets[selectedDate]) as MaintenanceTicket[])
      .filter(t => portalType === 'cx' ? isCxTicket(t) : (portalType === 'rides' ? !isCxTicket(t) : true))
      .sort((a, b) => new Date(b.reportedAt || 0).getTime() - new Date(a.reportedAt || 0).getTime());
  }, [baseTickets, maintenanceTickets, selectedDate, selectedStatusTab, viewScope, portalType]);

  // Filter tickets by search query
  const filteredTickets = useMemo(() => {
    return scopedTickets.filter(t => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const rideMatch = t.rideName?.toLowerCase().includes(q);
      const probMatch = t.problem?.toLowerCase().includes(q);
      const repMatch = t.reportedByName?.toLowerCase().includes(q);
      const dateMatch = t.date?.includes(q);
      const notesMatch = t.resolutionNotes?.toLowerCase().includes(q);
      const catMatch = t.feedbackCategory?.toLowerCase().includes(q);
      const guestMatch = t.guestDetails?.toLowerCase().includes(q);
      const techMatch = t.assignedToName?.toLowerCase().includes(q) || 
        t.helperNames?.some(h => h.toLowerCase().includes(q));
      return rideMatch || probMatch || repMatch || techMatch || dateMatch || notesMatch || catMatch || guestMatch;
    });
  }, [scopedTickets, searchQuery]);

  const reported = useMemo(() => filteredTickets.filter(t => t.status === 'reported'), [filteredTickets]);
  const inProgress = useMemo(() => filteredTickets.filter(t => t.status === 'in-progress'), [filteredTickets]);
  const solved = useMemo(() => {
    if (viewScope === 'unresolved' && selectedStatusTab !== 'solved') {
      const dateSolved = (maintenanceTickets[selectedDate] ? Object.values(maintenanceTickets[selectedDate]) : [])
        .filter((t: any) => t && t.status === 'solved' && (portalType === 'cx' ? isCxTicket(t) : (portalType === 'rides' ? !isCxTicket(t) : true))) as MaintenanceTicket[];
      return dateSolved;
    }
    return filteredTickets.filter(t => t.status === 'solved');
  }, [filteredTickets, maintenanceTickets, selectedDate, selectedStatusTab, viewScope, portalType]);

  // Force database re-fetch from server
  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await database.engine.fetchFullDatabase();
    } catch (e) {
      console.warn('Sync failed:', e);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // Handle Photo File Pick and Auto Compression
  const handlePhotoUpload = async (ticketId: string, file: File) => {
    if (!file) return;
    setIsCompressingTicketId(ticketId);
    try {
      const compressed = await compressImageToLightweightDataUrl(file);
      setPhotoByTicket(prev => ({
        ...prev,
        [ticketId]: compressed
      }));
    } catch (err) {
      console.error('Image compression error:', err);
      alert('Could not process this image. Please select a valid photo.');
    } finally {
      setIsCompressingTicketId(null);
    }
  };

  const handleRemovePhoto = (ticketId: string) => {
    setPhotoByTicket(prev => {
      const next = { ...prev };
      delete next[ticketId];
      return next;
    });
  };

  // Toggle technician selection for a specific ticket
  const toggleTechForTicket = (ticketId: string, techId: number) => {
    setSelectedTechsByTicket(prev => {
      const current = prev[ticketId] || [];
      if (current.includes(techId)) {
        return { ...prev, [ticketId]: current.filter(id => id !== techId) };
      } else {
        return { ...prev, [ticketId]: [...current, techId] };
      }
    });
  };

  // Select all technicians for a ticket
  const selectAllTechsForTicket = (ticketId: string) => {
    setSelectedTechsByTicket(prev => ({
      ...prev,
      [ticketId]: maintenancePersonnel.map(p => p.id)
    }));
  };

  // Clear technician selection for a ticket
  const clearTechsForTicket = (ticketId: string) => {
    setSelectedTechsByTicket(prev => ({
      ...prev,
      [ticketId]: []
    }));
  };

  // Assign multiple selected technicians and mark as in-progress
  const handleAssignSelectedTechs = (ticket: MaintenanceTicket) => {
    const selectedIds = selectedTechsByTicket[ticket.id] || [];
    if (selectedIds.length === 0) {
      alert('Please select at least one technician to assign.');
      return;
    }

    const selectedTechObjs = selectedIds
      .map(id => maintenancePersonnel.find(p => p.id === id))
      .filter((p): p is Operator => Boolean(p));

    if (selectedTechObjs.length === 0) return;

    const primaryTech = selectedTechObjs[0];
    const helpers = selectedTechObjs.slice(1);

    onUpdateTicketStatus(ticket, 'in-progress', primaryTech, helpers);

    // Clear local selection for this ticket
    setSelectedTechsByTicket(prev => {
      const next = { ...prev };
      delete next[ticket.id];
      return next;
    });
    setEditingTicketId(null);
  };

  // Start editing team for an in-progress ticket
  const handleStartEditTeam = (ticket: MaintenanceTicket) => {
    setEditingTicketId(ticket.id);
    const initialIds: number[] = [];
    if (ticket.assignedToId) initialIds.push(ticket.assignedToId);
    if (ticket.helperIds && Array.isArray(ticket.helperIds)) {
      ticket.helperIds.forEach(id => {
        if (!initialIds.includes(id)) initialIds.push(id);
      });
    }
    setSelectedTechsByTicket(prev => ({ ...prev, [ticket.id]: initialIds }));
  };

  // Save updated team for an in-progress ticket
  const handleSaveTeamEdit = (ticket: MaintenanceTicket) => {
    const selectedIds = selectedTechsByTicket[ticket.id] || [];
    if (selectedIds.length === 0) {
      alert('Please select at least one technician.');
      return;
    }

    const selectedTechObjs = selectedIds
      .map(id => maintenancePersonnel.find(p => p.id === id))
      .filter((p): p is Operator => Boolean(p));

    if (selectedTechObjs.length === 0) return;

    const primaryTech = selectedTechObjs[0];
    const helpers = selectedTechObjs.slice(1);

    onUpdateTicketStatus(ticket, 'in-progress', primaryTech, helpers);
    setEditingTicketId(null);
  };

  // Handle Mark Solved with auto-compressed photo & resolution note
  const handleMarkSolved = (ticket: MaintenanceTicket) => {
    const notes = resolutionNotesByTicket[ticket.id] || '';
    const assignedTech = maintenancePersonnel.find(p => p.id === ticket.assignedToId);
    const photoData = photoByTicket[ticket.id]?.dataUrl || ticket.solutionImageUrl || ticket.photoUrl;

    onUpdateTicketStatus(ticket, 'solved', assignedTech, undefined, notes, photoData);

    setResolutionNotesByTicket(prev => {
      const next = { ...prev };
      delete next[ticket.id];
      return next;
    });
    setPhotoByTicket(prev => {
      const next = { ...prev };
      delete next[ticket.id];
      return next;
    });
  };

  // Handle Create New Ticket
  const handleCreateNewTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketRideId || !newTicketProblem.trim()) {
      alert('Please select a ride and enter issue details.');
      return;
    }
    if (onReportProblem) {
      const isCX = portalType === 'cx';
      onReportProblem(
        Number(newTicketRideId),
        newTicketProblem.trim(),
        newTicketCategory || (isCX ? 'Guest Feedback' : 'Operational Issue'),
        newTicketPriority,
        newTicketGuestDetails.trim() || undefined,
        isCX ? 'cx' : 'operator'
      );
      setShowNewTicketModal(false);
      setNewTicketRideId('');
      setNewTicketProblem('');
      setNewTicketGuestDetails('');
      setNewTicketPriority('normal');
    }
  };

  const formatDateBadge = (dateStr?: string) => {
    if (!dateStr) return '';
    if (dateStr === todayStr) return 'Today';
    return dateStr;
  };

  const isCXPortal = portalType === 'cx';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Quick Portal Switcher Pills */}
      {onSwitchPortal && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 p-2.5 rounded-2xl border border-gray-700/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
              Active Maintenance Portal:
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onSwitchPortal('rides')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
                !isCXPortal
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-red-900/40 ring-2 ring-red-400/40'
                  : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-blue-300" />
              <span>Tickets & Repairs (Games & Ride Associates)</span>
              {ridesUnresolvedCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-red-950/90 text-red-200 border border-red-500/50 font-mono font-black animate-pulse">
                  {ridesUnresolvedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSwitchPortal('cx')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${
                isCXPortal
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-pink-900/40 ring-2 ring-pink-400/40'
                  : 'bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 border border-gray-700'
              }`}
            >
              <HeartHandshake className="w-4 h-4 text-pink-300" />
              <span>Customer Experience (CX)</span>
              {cxUnresolvedCount > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-pink-950/90 text-pink-200 border border-pink-500/50 font-mono font-black animate-pulse">
                  {cxUnresolvedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Header & Controls Bar */}
      <div className={`p-4 sm:p-5 rounded-2xl border shadow-lg flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 ${
        isCXPortal 
          ? 'bg-gradient-to-br from-gray-900 via-gray-850 to-pink-950/30 border-pink-900/40' 
          : 'bg-gray-800 border-gray-700'
      }`}>
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`p-2.5 rounded-xl border shadow-inner ${
              isCXPortal 
                ? 'bg-pink-900/40 text-pink-400 border-pink-800/60' 
                : 'bg-red-900/40 text-red-400 border-red-800/60'
            }`}>
              {isCXPortal ? <HeartHandshake className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isCXPortal ? 'Customer Experience (CX) — Tickets & Repairs' : 'Tickets & Repairs (Games & Ride Associates)'}
                </h2>
                {totalUnresolvedCount > 0 ? (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1 border ${
                    isCXPortal 
                      ? 'bg-pink-500/20 text-pink-300 border-pink-500/40' 
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}>
                    <span className={`w-2 h-2 rounded-full animate-ping ${isCXPortal ? 'bg-pink-500' : 'bg-red-500'}`} />
                    {totalUnresolvedCount} Active
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Check className="w-3 h-3" /> All Operational
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {isCXPortal 
                  ? 'Real-time guest feedback, ride condition complaints, and repair dispatch from the Customer Experience (CX) team' 
                  : 'Real-time ride breakdown monitoring & technical dispatch reported by Games & Ride Associates'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Force Sync button with live status */}
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 bg-gray-900/80 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold border border-gray-700 transition-all active:scale-95 shadow-sm"
            title="Force refresh tickets from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Live Sync'}</span>
          </button>

          {/* Date Picker & Today Shortcut */}
          <div className="flex items-center gap-1.5 bg-gray-900/60 border border-gray-700 rounded-xl px-2.5 py-1.5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => {
                onDateChange(e.target.value);
                if (viewScope !== 'date') setViewScope('date');
              }} 
              className="bg-transparent text-white text-xs sm:text-sm outline-none cursor-pointer"
            />
            {selectedDate !== todayStr && (
              <button
                onClick={() => {
                  onDateChange(todayStr);
                  setViewScope('date');
                }}
                className="text-[11px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded-md font-medium transition-colors"
                title="Jump to today"
              >
                Today
              </button>
            )}
          </div>

          {/* Export & Download Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowDownloadMenu(prev => !prev)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-900/30 transition-all active:scale-95"
              title="Download reports or export data"
            >
              <Download className="w-4 h-4" />
              <span>Download / Export</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDownloadMenu ? 'rotate-180' : ''}`} />
            </button>

            {showDownloadMenu && (
              <div className="absolute right-0 mt-2 w-72 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 backdrop-blur-md">
                <div className="px-3 py-2 border-b border-gray-800 mb-1.5">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    Maintenance & CX Exports
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Instant CSV and Printable PDF Audit Logs
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Option 1: Download Solved Issues CSV */}
                  <button
                    onClick={() => downloadTicketsCSV(allSolvedTicketsFlat, 'Maintenance_Solved_Issues')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-emerald-950/60 border border-transparent hover:border-emerald-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-emerald-900/50 rounded-lg text-emerald-400 group-hover:bg-emerald-800/80 transition-colors">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100">All Solved Issues (CSV)</div>
                        <div className="text-[10px] text-gray-400">Complete resolved maintenance history</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-900/70 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                      {allSolvedTicketsFlat.length}
                    </span>
                  </button>

                  {/* Option 2: Download Solved for Selected Date */}
                  <button
                    onClick={() => downloadTicketsCSV(solved, `Solved_Issues_${selectedDate}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-emerald-950/60 border border-transparent hover:border-emerald-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-teal-900/50 rounded-lg text-teal-400 group-hover:bg-teal-800/80 transition-colors">
                        <Calendar className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100">Solved ({selectedDate}) (CSV)</div>
                        <div className="text-[10px] text-gray-400">Selected date resolved tickets</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-teal-900/70 text-teal-300 px-2 py-0.5 rounded-full font-bold">
                      {solved.length}
                    </span>
                  </button>

                  {/* Option 3: Download Customer Experience (CX) Feedbacks CSV */}
                  <button
                    onClick={() => downloadTicketsCSV(allCxTicketsFlat, 'Customer_Experience_Feedbacks')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-pink-950/60 border border-transparent hover:border-pink-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-pink-900/50 rounded-lg text-pink-400 group-hover:bg-pink-800/80 transition-colors">
                        <HeartHandshake className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100">Customer Experience (CX) (CSV)</div>
                        <div className="text-[10px] text-gray-400">Guest feedbacks, categories & resolutions</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-pink-900/70 text-pink-300 px-2 py-0.5 rounded-full font-bold">
                      {allCxTicketsFlat.length}
                    </span>
                  </button>

                  {/* Option 4: Download Solved CX Only */}
                  <button
                    onClick={() => downloadTicketsCSV(allCxSolvedTicketsFlat, 'Customer_Experience_Solved')}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-pink-950/60 border border-transparent hover:border-pink-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-rose-900/50 rounded-lg text-rose-400 group-hover:bg-rose-800/80 transition-colors">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100">CX Solved Issues Only (CSV)</div>
                        <div className="text-[10px] text-gray-400">Resolved guest comfort & safety issues</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-rose-900/70 text-rose-300 px-2 py-0.5 rounded-full font-bold">
                      {allCxSolvedTicketsFlat.length}
                    </span>
                  </button>

                  {/* Option 5: Download Current View / Filtered Tickets */}
                  <button
                    onClick={() => downloadTicketsCSV(filteredTickets, `Maintenance_Filtered_${portalType}`)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-gray-200 hover:text-white hover:bg-blue-950/60 border border-transparent hover:border-blue-800/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 bg-blue-900/50 rounded-lg text-blue-400 group-hover:bg-blue-800/80 transition-colors">
                        <Filter className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-100">Current Filtered View (CSV)</div>
                        <div className="text-[10px] text-gray-400">Currently displayed tickets</div>
                      </div>
                    </div>
                    <span className="text-[10px] bg-blue-900/70 text-blue-300 px-2 py-0.5 rounded-full font-bold">
                      {filteredTickets.length}
                    </span>
                  </button>

                  <div className="border-t border-gray-800 my-1 pt-1">
                    {/* Option 6: Print / Save PDF Audit Report */}
                    <button
                      onClick={() => handlePrintAuditReport(
                        filteredTickets.length > 0 ? filteredTickets : baseTickets,
                        isCXPortal ? 'Customer Experience (CX) Audit & Resolution Report' : 'Ride Maintenance & Breakdown Audit Report',
                        `Comprehensive audit log for ${selectedDate} • Toggi Fun World System`
                      )}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-950/60 border border-transparent hover:border-purple-800/60 transition-colors text-left group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-purple-900/50 rounded-lg text-purple-400 group-hover:bg-purple-800/80 transition-colors">
                          <Printer className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-purple-200">Print / PDF Audit Report</div>
                          <div className="text-[10px] text-purple-400/80">Formatted printable summary & table</div>
                        </div>
                      </div>
                      <FileText className="w-3.5 h-3.5 text-purple-400" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {onReportProblem && rides.length > 0 && (
            <button
              onClick={() => {
                setNewTicketCategory(isCXPortal ? 'Guest Comfort & Seating' : 'Operational Issue');
                setShowNewTicketModal(true);
              }}
              className={`text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
                isCXPortal
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-pink-900/30'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-900/30'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isCXPortal ? 'Log CX Feedback / Issue' : 'Report Associate Issue'}</span>
            </button>
          )}

          {solved.length > 0 && (
            <button 
              onClick={() => onClearSolved(selectedDate)} 
              className="bg-gray-700/80 hover:bg-gray-700 text-gray-300 hover:text-white px-3 py-2 rounded-xl text-xs font-semibold border border-gray-600 transition-all flex items-center gap-1.5"
              title="Clear all solved tickets for this date"
            >
              <Trash2 className="w-3.5 h-3.5 text-gray-400" />
              <span>Clear Solved ({solved.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Scope Selector: All Unresolved vs Solved vs Selected Date vs All History */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-850/90 p-2.5 rounded-2xl border border-gray-750">
        <div className="flex flex-wrap bg-gray-900/90 p-1 rounded-xl border border-gray-700/80 gap-1">
          <button
            onClick={() => {
              setViewScope('unresolved');
              if (selectedStatusTab === 'solved') setSelectedStatusTab('all');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewScope === 'unresolved'
                ? isCXPortal 
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40'
                  : 'bg-red-600 text-white shadow-md shadow-red-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Active & Unresolved ({totalUnresolvedCount})</span>
          </button>
          <button
            onClick={() => {
              setViewScope('solved');
              setSelectedStatusTab('solved');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewScope === 'solved' || selectedStatusTab === 'solved'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Solved & Resolved ({totalSolvedCount})</span>
          </button>
          <button
            onClick={() => {
              setViewScope('date');
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewScope === 'date'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Date: {selectedDate === todayStr ? 'Today' : selectedDate}</span>
          </button>
          <button
            onClick={() => setViewScope('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewScope === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/40'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All History ({baseTickets.length})</span>
          </button>
        </div>

        {viewScope === 'unresolved' && totalUnresolvedCount > 0 && (
          <div className="text-xs text-yellow-400 flex items-center gap-1.5 px-3 py-1 bg-yellow-950/40 border border-yellow-800/60 rounded-xl">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>Showing all active issues from all dates so no report is ever missed</span>
          </div>
        )}

        {(viewScope === 'solved' || selectedStatusTab === 'solved') && (
          <div className="text-xs text-emerald-300 flex items-center gap-2 px-3 py-1 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Showing all resolved maintenance issues with resolution notes &amp; proof photos</span>
          </div>
        )}
      </div>

      {/* Solved Summary Statistics Bar (when viewing Solved records) */}
      {(viewScope === 'solved' || selectedStatusTab === 'solved') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-850/70 p-3 rounded-2xl border border-gray-750">
          <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white">{totalSolvedCount}</div>
              <div className="text-[11px] text-gray-400">Total Solved Issues</div>
            </div>
          </div>

          <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white">{totalSolvedWithPhotosCount}</div>
              <div className="text-[11px] text-gray-400">With Proof Photos</div>
            </div>
          </div>

          <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white">{solvedTodayCount}</div>
              <div className="text-[11px] text-gray-400">Resolved Today</div>
            </div>
          </div>

          <div className="bg-gray-900/80 p-3 rounded-xl border border-gray-700/60 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-extrabold text-white">{maintenancePersonnel.length}</div>
              <div className="text-[11px] text-gray-400">Tech Personnel Active</div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Status Tabs Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text"
            placeholder="Search ride, technician, problem, category, note..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 text-white pl-9 pr-3 py-2 rounded-xl border border-gray-700 text-xs sm:text-sm outline-none focus:border-blue-500 placeholder-gray-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Tabs */}
        <div className="flex bg-gray-800 p-1 rounded-xl border border-gray-700 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setSelectedStatusTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedStatusTab === 'all' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            All ({filteredTickets.length})
          </button>
          <button
            onClick={() => setSelectedStatusTab('reported')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatusTab === 'reported' 
                ? isCXPortal ? 'bg-pink-900/60 text-pink-200 border border-pink-700/60' : 'bg-red-900/60 text-red-200 border border-red-700/60' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${isCXPortal ? 'bg-pink-500' : 'bg-red-500'}`} />
            Reported ({reported.length})
          </button>
          <button
            onClick={() => setSelectedStatusTab('in-progress')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatusTab === 'in-progress' ? 'bg-yellow-900/60 text-yellow-200 border border-yellow-700/60' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            In Progress ({inProgress.length})
          </button>
          <button
            onClick={() => setSelectedStatusTab('solved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selectedStatusTab === 'solved' ? 'bg-emerald-900/70 text-emerald-200 border border-emerald-600/70 font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Solved ({solved.length})
          </button>
        </div>
      </div>

      {/* 3-Column Ticket Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. REPORTED COLUMN */}
        {(selectedStatusTab === 'all' || selectedStatusTab === 'reported') && (
          <div className={`bg-gray-800/60 rounded-2xl p-4 border border-gray-700/80 border-t-4 flex flex-col min-h-[400px] ${
            isCXPortal ? 'border-t-pink-500' : 'border-t-red-500'
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/60">
              <div className="flex items-center gap-2">
                {isCXPortal ? <HeartHandshake className="w-5 h-5 text-pink-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
                <h3 className="font-bold text-base text-gray-100">
                  {isCXPortal ? 'Reported CX Feedbacks & Issues' : 'Reported Issues (Associates)'}
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                isCXPortal ? 'bg-pink-900/50 text-pink-300 border-pink-800/80' : 'bg-red-900/50 text-red-300 border-red-800/80'
              }`}>
                {reported.length}
              </span>
            </div>

            <div className="space-y-4 flex-grow">
              {reported.map(ticket => {
                const selectedTechIds = selectedTechsByTicket[ticket.id] || [];
                const isSelectedAny = selectedTechIds.length > 0;
                const isFromCX = isCxTicket(ticket);

                return (
                  <div key={ticket.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700 shadow-md hover:border-gray-600 transition-all">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-base text-blue-400 leading-tight">{ticket.rideName}</span>
                        {/* Reporter & Source Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {isFromCX ? (
                            <span className="text-[10px] bg-pink-950/80 text-pink-300 border border-pink-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <HeartHandshake className="w-2.5 h-2.5 text-pink-400" /> CX Team
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Gamepad2 className="w-2.5 h-2.5 text-blue-400" /> Games Associate
                            </span>
                          )}

                          {ticket.feedbackCategory && (
                            <span className="text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md font-medium">
                              {ticket.feedbackCategory}
                            </span>
                          )}

                          {ticket.priority && ticket.priority !== 'normal' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-0.5 ${
                              ticket.priority === 'urgent' 
                                ? 'bg-red-600 text-white animate-pulse' 
                                : 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                            }`}>
                              <Flame className="w-2.5 h-2.5" />
                              {ticket.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {ticket.date && (
                          <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono">
                            {formatDateBadge(ticket.date)}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 bg-gray-900/80 px-2 py-0.5 rounded font-mono whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3 text-gray-500" />
                          {new Date(ticket.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Problem Description */}
                    <div className={`p-2.5 rounded-lg mb-3 border ${
                      isFromCX 
                        ? 'bg-pink-950/20 border-pink-900/40' 
                        : 'bg-red-950/30 border-red-900/50'
                    }`}>
                      <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-medium">{ticket.problem}</p>
                      
                      {ticket.guestDetails && (
                        <div className="mt-1.5 pt-1.5 border-t border-pink-900/30 text-[11px] text-pink-300 flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3 text-pink-400 flex-shrink-0" />
                          <span>Guest Note: <strong>{ticket.guestDetails}</strong></span>
                        </div>
                      )}

                      <div className="text-[11px] text-gray-400 mt-1.5 flex items-center justify-between">
                        <span>Reported by: <strong className="text-gray-300">{ticket.reportedByName}</strong></span>
                      </div>
                    </div>

                    {/* Multi-Technician Assignment Section */}
                    <div className="mt-3 pt-2.5 border-t border-gray-700/80">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-blue-400" />
                          <span>Select Technicians ({selectedTechIds.length} chosen):</span>
                        </label>
                        {maintenancePersonnel.length > 1 && (
                          <div className="flex gap-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => selectAllTechsForTicket(ticket.id)}
                              className="text-blue-400 hover:text-blue-300 underline"
                            >
                              All
                            </button>
                            <span className="text-gray-600">•</span>
                            <button
                              type="button"
                              onClick={() => clearTechsForTicket(ticket.id)}
                              className="text-gray-400 hover:text-gray-300"
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Technician Checkboxes Grid */}
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1 mb-3 scrollbar-thin">
                        {maintenancePersonnel.map(tech => {
                          const isSelected = selectedTechIds.includes(tech.id);
                          return (
                            <button
                              key={tech.id}
                              type="button"
                              onClick={() => toggleTechForTicket(ticket.id, tech.id)}
                              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium flex items-center justify-between transition-all text-left ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                                  : 'bg-gray-750 text-gray-300 border-gray-650 hover:bg-gray-700'
                              }`}
                            >
                              <span className="truncate">{tech.name}</span>
                              {isSelected && <Check className="w-3 h-3 flex-shrink-0 ml-1" />}
                            </button>
                          );
                        })}
                      </div>

                      {/* Action Button: Assign Selected & Start */}
                      <button
                        type="button"
                        disabled={!isSelectedAny}
                        onClick={() => handleAssignSelectedTechs(ticket)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 ${
                          isSelectedAny
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-900/40'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>
                          {selectedTechIds.length === 0
                            ? 'Select Technicians Above'
                            : selectedTechIds.length === 1
                            ? `Assign 1 Technician & Start Work`
                            : `Assign ${selectedTechIds.length} Technicians & Start Work`}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {reported.length === 0 && (
                <div className="text-center py-10 px-4 text-gray-500 bg-gray-850/40 rounded-xl border border-gray-800 border-dashed">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm font-medium">No reported issues</p>
                  <p className="text-xs text-gray-600 mt-1">All rides operating normally</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. IN-PROGRESS COLUMN */}
        {(selectedStatusTab === 'all' || selectedStatusTab === 'in-progress') && (
          <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700/80 border-t-4 border-t-yellow-500 flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/60">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-400" />
                <h3 className="font-bold text-base text-gray-100">In Progress</h3>
              </div>
              <span className="bg-yellow-900/50 text-yellow-300 border border-yellow-800/80 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {inProgress.length}
              </span>
            </div>

            <div className="space-y-4 flex-grow">
              {inProgress.map(ticket => {
                const isEditingThis = editingTicketId === ticket.id;
                const editSelectedIds = selectedTechsByTicket[ticket.id] || [];
                const isFromCX = isCxTicket(ticket);

                const allAssignedNames: string[] = [];
                if (ticket.assignedToName) allAssignedNames.push(ticket.assignedToName);
                if (ticket.helperNames && Array.isArray(ticket.helperNames)) {
                  ticket.helperNames.forEach(name => {
                    if (!allAssignedNames.includes(name)) allAssignedNames.push(name);
                  });
                }

                return (
                  <div key={ticket.id} className="bg-gray-800 rounded-xl p-4 border border-yellow-700/50 shadow-md">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-base text-yellow-400 leading-tight">{ticket.rideName}</span>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          {isFromCX ? (
                            <span className="text-[10px] bg-pink-950/80 text-pink-300 border border-pink-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <HeartHandshake className="w-2.5 h-2.5 text-pink-400" /> CX Team
                            </span>
                          ) : (
                            <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                              <Gamepad2 className="w-2.5 h-2.5 text-blue-400" /> Associate
                            </span>
                          )}

                          {ticket.feedbackCategory && (
                            <span className="text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md font-medium">
                              {ticket.feedbackCategory}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ticket.date && (
                          <span className="text-[10px] text-amber-300 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono">
                            {formatDateBadge(ticket.date)}
                          </span>
                        )}
                        <span className="text-[11px] text-yellow-300 bg-yellow-950/80 px-2 py-0.5 rounded font-mono whitespace-nowrap flex items-center gap-1">
                          <Clock className="w-3 h-3 text-yellow-400" />
                          {ticket.inProgressAt ? new Date(ticket.inProgressAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Working'}
                        </span>
                      </div>
                    </div>

                    {/* Problem */}
                    <div className="bg-gray-900/60 p-2.5 rounded-lg mb-3 border border-gray-750">
                      <p className="text-xs sm:text-sm text-gray-200 leading-relaxed">{ticket.problem}</p>
                      {ticket.guestDetails && (
                        <div className="mt-1 text-[11px] text-pink-300 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-pink-400" />
                          <span>Guest: {ticket.guestDetails}</span>
                        </div>
                      )}
                    </div>

                    {/* Assigned Tech Team Section */}
                    <div className="bg-gray-900/60 p-2.5 rounded-lg mb-3 border border-gray-750">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-yellow-400" />
                          Assigned Team ({allAssignedNames.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEditingThis) {
                              setEditingTicketId(null);
                            } else {
                              handleStartEditTeam(ticket);
                            }
                          }}
                          className="text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                        >
                          {isEditingThis ? 'Cancel Edit' : 'Edit Team'}
                        </button>
                      </div>

                      {/* Editing Team Selection Mode */}
                      {isEditingThis ? (
                        <div className="space-y-2 pt-1 border-t border-gray-700">
                          <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                            {maintenancePersonnel.map(tech => {
                              const isSelected = editSelectedIds.includes(tech.id);
                              return (
                                <button
                                  key={tech.id}
                                  type="button"
                                  onClick={() => toggleTechForTicket(ticket.id, tech.id)}
                                  className={`text-xs px-2 py-1.5 rounded-lg border font-medium flex items-center justify-between transition-all ${
                                    isSelected
                                      ? 'bg-blue-600 text-white border-blue-400'
                                      : 'bg-gray-700 text-gray-300 border-gray-600'
                                  }`}
                                >
                                  <span className="truncate">{tech.name}</span>
                                  {isSelected && <Check className="w-3 h-3 flex-shrink-0" />}
                                </button>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSaveTeamEdit(ticket)}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Save Assigned Team ({editSelectedIds.length})
                          </button>
                        </div>
                      ) : (
                        /* Standard View of Assigned Team */
                        <div className="flex flex-wrap gap-1.5">
                          {allAssignedNames.length > 0 ? (
                            allAssignedNames.map((name, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-yellow-900/30 text-yellow-200 border border-yellow-700/60 font-semibold"
                              >
                                <UserCheck className="w-3 h-3 text-yellow-400" />
                                {name}
                                {idx === 0 && <span className="text-[10px] text-yellow-400/80 font-normal">(Lead)</span>}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500 italic">No technicians listed</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Photo Attachment & Auto-Compression Area */}
                    <div className="bg-gray-900/60 p-2.5 rounded-lg mb-3 border border-gray-750">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5 text-yellow-400" />
                          Repair Photo (Proof of Fix):
                        </span>
                        {isCompressingTicketId === ticket.id && (
                          <span className="text-[11px] text-yellow-400 animate-pulse flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Compressing...
                          </span>
                        )}
                      </div>

                      {/* Hidden File Input for this ticket */}
                      <input 
                        id={`photo-input-${ticket.id}`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(ticket.id, file);
                          e.target.value = '';
                        }}
                      />

                      {/* If Photo is Selected or Attached */}
                      {(photoByTicket[ticket.id]?.dataUrl || ticket.solutionImageUrl || ticket.photoUrl) ? (
                        <div className="space-y-2">
                          <div className="relative group rounded-xl overflow-hidden border border-yellow-700/60 bg-black/40 flex items-center gap-3 p-2">
                            <img 
                              src={photoByTicket[ticket.id]?.dataUrl || ticket.solutionImageUrl || ticket.photoUrl} 
                              alt="Repair Preview"
                              className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-gray-700 flex-shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => {
                                const url = photoByTicket[ticket.id]?.dataUrl || ticket.solutionImageUrl || ticket.photoUrl || '';
                                setLightboxPhoto({
                                  url,
                                  rideName: ticket.rideName,
                                  problem: ticket.problem,
                                  resolutionNotes: resolutionNotesByTicket[ticket.id] || ticket.resolutionNotes,
                                  date: ticket.date,
                                  techNames: allAssignedNames
                                });
                              }}
                            />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 text-xs font-bold text-green-400">
                                <Check className="w-3.5 h-3.5" />
                                <span>Photo Attached</span>
                              </div>
                              
                              <p className="text-[10px] text-gray-300 font-mono mt-0.5">
                                {photoByTicket[ticket.id] ? (
                                  <>
                                    Size: <strong>{photoByTicket[ticket.id].sizeKb} KB</strong>
                                    {photoByTicket[ticket.id].originalSizeKb ? (
                                      <span className="text-gray-400"> (compressed from {photoByTicket[ticket.id].originalSizeKb} KB)</span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span>Cloud attached proof</span>
                                )}
                              </p>

                              <div className="flex gap-2 mt-2">
                                <label
                                  htmlFor={`photo-input-${ticket.id}`}
                                  className="text-[11px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 cursor-pointer font-medium"
                                >
                                  Change
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePhoto(ticket.id)}
                                  className="text-[11px] px-2 py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-medium"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Upload Trigger Box */
                        <label 
                          htmlFor={`photo-input-${ticket.id}`}
                          className="cursor-pointer group flex items-center justify-between p-2.5 rounded-xl border border-dashed border-gray-700 hover:border-yellow-500/70 bg-gray-950/40 hover:bg-yellow-950/20 transition-all select-none"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400 group-hover:bg-yellow-500/20 transition-colors">
                              <Camera className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-200 group-hover:text-yellow-300 transition-colors">
                                Add / Take Repair Photo
                              </div>
                              <div className="text-[10px] text-gray-400">
                                Auto-compressed to ultra-light size (&lt;40KB)
                              </div>
                            </div>
                          </div>
                          
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-yellow-900/40 text-yellow-300 border border-yellow-700/50 group-hover:bg-yellow-600 group-hover:text-white transition-all flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Attach
                          </span>
                        </label>
                      )}
                    </div>

                    {/* Resolution Notes & Actions */}
                    <div className="space-y-2 pt-2 border-t border-gray-700/80">
                      <input
                        type="text"
                        placeholder="Resolution note (e.g. part replaced, sensor recalibrated, tested OK)..."
                        value={resolutionNotesByTicket[ticket.id] || ''}
                        onChange={(e) => setResolutionNotesByTicket({ ...resolutionNotesByTicket, [ticket.id]: e.target.value })}
                        className="w-full bg-gray-900/80 text-white rounded-lg px-2.5 py-1.5 text-xs border border-gray-700 outline-none focus:border-green-500 placeholder-gray-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleMarkSolved(ticket)}
                          className="flex-1 py-2 px-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {photoByTicket[ticket.id]?.dataUrl || ticket.solutionImageUrl
                              ? 'Mark Solved (With Photo)'
                              : 'Mark Solved'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateTicketStatus(ticket, 'reported')}
                          className="px-2.5 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-xs font-medium transition-colors"
                          title="Move back to reported"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {inProgress.length === 0 && (
                <div className="text-center py-10 px-4 text-gray-500 bg-gray-850/40 rounded-xl border border-gray-800 border-dashed">
                  <Clock className="w-8 h-8 mx-auto text-gray-600 mb-2" />
                  <p className="text-sm font-medium">No repairs in progress</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 3. SOLVED COLUMN / DEDICATED SOLVED VIEW */}
        {(selectedStatusTab === 'all' || selectedStatusTab === 'solved') && (
          <div className={`bg-gray-800/60 rounded-2xl p-4 border border-gray-700/80 border-t-4 border-t-emerald-500 flex flex-col min-h-[400px] ${
            selectedStatusTab === 'solved' ? 'lg:col-span-3' : ''
          }`}>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700/60">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base text-gray-100">
                  {selectedStatusTab === 'solved' || viewScope === 'solved' ? 'Resolved Issues & Fix Proofs' : 'Resolved Records'}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {solved.length > 0 && (
                  <button
                    onClick={() => downloadTicketsCSV(solved, `Maintenance_Solved_${selectedDate || 'Records'}`)}
                    className="text-xs px-2.5 py-1 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 hover:text-white rounded-lg transition-all flex items-center gap-1.5 border border-emerald-700/80 font-bold active:scale-95 shadow-sm"
                    title="Download solved issues for current view as CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download Solved (CSV)</span>
                  </button>
                )}
                <span className="bg-emerald-900/50 text-emerald-300 border border-emerald-800/80 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {solved.length} Solved
                </span>
                {solved.length > 0 && selectedDate && (
                  <button
                    onClick={() => onClearSolved(selectedDate)}
                    className="text-[11px] px-2 py-1 bg-gray-750 hover:bg-gray-700 text-gray-300 hover:text-red-300 rounded-lg transition-colors flex items-center gap-1 border border-gray-650"
                    title="Clear solved tickets for selected date"
                  >
                    <Trash2 className="w-3 h-3 text-gray-400" />
                    <span>Clear Date</span>
                  </button>
                )}
              </div>
            </div>

            <div className={selectedStatusTab === 'solved' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow' : 'space-y-4 flex-grow'}>
              {solved.map(ticket => {
                const isFromCX = isCxTicket(ticket);
                const allAssignedNames: string[] = [];
                if (ticket.assignedToName) allAssignedNames.push(ticket.assignedToName);
                if (ticket.helperNames && Array.isArray(ticket.helperNames)) {
                  ticket.helperNames.forEach(name => {
                    if (!allAssignedNames.includes(name)) allAssignedNames.push(name);
                  });
                }

                const photoUrl = ticket.solutionImageUrl || ticket.photoUrl;
                const turnaround = formatTurnaroundDuration(ticket.reportedAt, ticket.solvedAt);

                return (
                  <div key={ticket.id} className="bg-gray-800 rounded-xl p-4 border border-gray-700/80 shadow-md hover:border-emerald-700/60 transition-all flex flex-col justify-between">
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div>
                          <span className="font-bold text-base text-gray-100 leading-tight block">{ticket.rideName}</span>
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {isFromCX ? (
                              <span className="text-[10px] bg-pink-950/80 text-pink-300 border border-pink-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <HeartHandshake className="w-2.5 h-2.5 text-pink-400" /> CX
                              </span>
                            ) : (
                              <span className="text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/70 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                <Gamepad2 className="w-2.5 h-2.5 text-blue-400" /> Associate
                              </span>
                            )}

                            {ticket.feedbackCategory && (
                              <span className="text-[10px] bg-purple-950/70 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded-md font-medium">
                                {ticket.feedbackCategory}
                              </span>
                            )}
                          </div>
                          {ticket.date && (
                            <span className="text-[10px] text-gray-400 font-mono mt-1 block">
                              Date: {formatDateBadge(ticket.date)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[11px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded font-bold whitespace-nowrap flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-400" />
                            Resolved
                          </span>
                          {turnaround && (
                            <span className="text-[10px] text-yellow-400 bg-yellow-950/40 border border-yellow-800/40 px-1.5 py-0.2 rounded font-mono flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              Fixed in {turnaround}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Problem Description */}
                      <div className="bg-gray-900/60 p-2.5 rounded-lg mb-2 border border-gray-750">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Reported Issue:</div>
                        <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-medium">{ticket.problem}</p>
                        {ticket.guestDetails && (
                          <div className="mt-1 text-[11px] text-pink-300 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-pink-400" />
                            <span>Guest: {ticket.guestDetails}</span>
                          </div>
                        )}
                      </div>

                      {/* Resolution Photo Card (if attached) */}
                      {photoUrl ? (
                        <div className="mb-2 p-2 bg-emerald-950/20 rounded-xl border border-emerald-800/50 hover:border-emerald-500/80 flex items-center justify-between gap-3 transition-all shadow-sm">
                          <div 
                            onClick={() => setLightboxPhoto({
                              url: photoUrl,
                              rideName: ticket.rideName,
                              problem: ticket.problem,
                              resolutionNotes: ticket.resolutionNotes,
                              date: ticket.date,
                              techNames: allAssignedNames
                            })}
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                          >
                            <img 
                              src={photoUrl} 
                              alt="Solution Proof" 
                              className="w-14 h-14 rounded-lg object-cover border border-emerald-700/60 group-hover:scale-105 transition-transform flex-shrink-0" 
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                                <Camera className="w-3.5 h-3.5" />
                                <span>Proof of Fix Photo</span>
                              </div>
                              <p className="text-[11px] text-gray-400 group-hover:text-emerald-300 flex items-center gap-1 mt-0.5 font-medium">
                                Click to view full photo <Maximize2 className="w-2.5 h-2.5" />
                              </p>
                            </div>
                          </div>

                          <a
                            href={photoUrl}
                            download={`Proof_${ticket.rideName.replace(/\s+/g, '_')}_${ticket.date || todayStr}.jpg`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-gray-800 hover:bg-emerald-700 text-gray-300 hover:text-white rounded-lg border border-gray-700 hover:border-emerald-600 transition-colors shadow-sm flex items-center gap-1 text-xs"
                            title="Download proof photo directly"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                          </a>
                        </div>
                      ) : (
                        <div className="mb-2 p-1.5 bg-gray-900/30 rounded-lg border border-gray-800 text-[11px] text-gray-500 flex items-center gap-1">
                          <Camera className="w-3 h-3 text-gray-600" />
                          <span>No photo attached with fix</span>
                        </div>
                      )}

                      {/* Resolution Notes */}
                      {ticket.resolutionNotes && (
                        <div className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded-lg mb-2 text-xs text-emerald-300">
                          <strong className="text-emerald-400">Resolution Note: </strong> {ticket.resolutionNotes}
                        </div>
                      )}

                      {/* Solved Team Roster */}
                      <div className="mb-2 p-2 bg-gray-900/50 rounded-lg text-xs border border-gray-750">
                        <div className="text-[10px] text-gray-400 mb-1 flex items-center gap-1 font-semibold uppercase tracking-wider">
                          <Users className="w-3 h-3 text-emerald-400" />
                          Resolved By Team:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {allAssignedNames.length > 0 ? (
                            allAssignedNames.map((name, idx) => (
                              <span key={idx} className="text-[11px] bg-gray-750 text-gray-200 px-2 py-0.5 rounded border border-gray-650">
                                {name}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 italic">Maintenance Technician</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timestamps & Reopen Action */}
                    <div className="pt-2 border-t border-gray-700/60 mt-2">
                      <div className="text-[11px] text-gray-400 flex justify-between items-center mb-2">
                        <span>Reported by: <strong className="text-gray-300">{ticket.reportedByName}</strong></span>
                        {ticket.solvedAt && (
                          <span className="text-emerald-400 font-mono">
                            Solved: {new Date(ticket.solvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const primaryTech = maintenancePersonnel.find(p => p.id === ticket.assignedToId) || maintenancePersonnel[0];
                            const helpers = ticket.helperIds 
                              ? ticket.helperIds.map(id => maintenancePersonnel.find(p => p.id === id)).filter((p): p is Operator => Boolean(p))
                              : [];
                            onUpdateTicketStatus(ticket, 'in-progress', primaryTech, helpers, ticket.resolutionNotes, ticket.solutionImageUrl || ticket.photoUrl);
                          }}
                          className="flex-1 py-1.5 px-2 bg-gray-750 hover:bg-yellow-900/40 text-gray-300 hover:text-yellow-300 rounded-lg text-xs font-semibold border border-gray-650 transition-colors flex items-center justify-center gap-1"
                          title="Re-open issue and move back to In-Progress"
                        >
                          <RotateCcw className="w-3 h-3 text-yellow-400" />
                          <span>Re-open / Re-inspect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {solved.length === 0 && (
                <div className="col-span-full text-center py-12 px-4 text-gray-400 bg-gray-850/40 rounded-xl border border-gray-800 border-dashed">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/40 mb-2" />
                  <p className="text-sm font-semibold text-gray-300">No resolved maintenance issues found</p>
                  <p className="text-xs text-gray-500 mt-1">
                    When technicians resolve reported problems, they will appear here with timestamps, proof photos, and technician notes.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full-Screen Photo Lightbox Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-md animate-fade-in-up">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Lightbox Header */}
            <div className="p-4 bg-gray-850 border-b border-gray-750 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-green-400" />
                  <span>{lightboxPhoto.rideName} — Repair Photo</span>
                </h4>
                {lightboxPhoto.date && (
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Date: {lightboxPhoto.date}</p>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <a 
                  href={lightboxPhoto.url} 
                  download={`maintenance-${lightboxPhoto.rideName.replace(/\s+/g, '_')}.jpg`}
                  className="p-2 rounded-lg bg-gray-750 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxPhoto(null)}
                  className="p-2 rounded-lg bg-gray-750 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Image Viewport */}
            <div className="p-4 bg-black/70 flex items-center justify-center overflow-auto flex-grow max-h-[55vh]">
              <img 
                src={lightboxPhoto.url} 
                alt="Full resolution repair solution"
                className="max-h-[50vh] w-auto max-w-full object-contain rounded-xl shadow-lg border border-gray-800" 
              />
            </div>

            {/* Lightbox Footer Details */}
            <div className="p-4 bg-gray-850 border-t border-gray-750 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="font-bold text-gray-400">Problem:</span>
                <span className="text-gray-200">{lightboxPhoto.problem}</span>
              </div>

              {lightboxPhoto.resolutionNotes && (
                <div className="flex items-start gap-2 text-green-300">
                  <span className="font-bold text-green-400">Resolution:</span>
                  <span>{lightboxPhoto.resolutionNotes}</span>
                </div>
              )}

              {lightboxPhoto.techNames && lightboxPhoto.techNames.length > 0 && (
                <div className="flex items-center gap-1.5 text-gray-400 pt-1">
                  <Users className="w-3 h-3 text-yellow-400" />
                  <span>Team: <strong className="text-gray-300">{lightboxPhoto.techNames.join(', ')}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Maintenance / CX Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in-up">
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 w-full max-w-lg overflow-hidden">
            <div className={`p-5 border-b border-gray-700 flex justify-between items-center ${
              isCXPortal ? 'bg-gradient-to-r from-pink-950/60 to-gray-900' : 'bg-gray-900/60'
            }`}>
              <div className="flex items-center gap-2">
                {isCXPortal ? <HeartHandshake className="w-5 h-5 text-pink-400" /> : <Wrench className="w-5 h-5 text-red-400" />}
                <h3 className="text-lg font-bold text-white">
                  {isCXPortal ? 'Log Customer Experience (CX) Issue' : 'Report Associate Issue (Games & Rides)'}
                </h3>
              </div>
              <button 
                onClick={() => setShowNewTicketModal(false)}
                className="text-gray-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Select Ride / Attraction:
                </label>
                <select
                  required
                  value={newTicketRideId}
                  onChange={(e) => setNewTicketRideId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-gray-700 text-white rounded-xl p-3 border border-gray-600 outline-none focus:border-blue-500 text-sm"
                >
                  <option value="">-- Choose a Ride / Attraction --</option>
                  {rides.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.floor || 'Main'})
                    </option>
                  ))}
                </select>
              </div>

              {isCXPortal && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-pink-400" />
                    <span>Feedback / Issue Category:</span>
                  </label>
                  <select
                    value={newTicketCategory}
                    onChange={(e) => setNewTicketCategory(e.target.value)}
                    className="w-full bg-gray-700 text-white rounded-xl p-3 border border-gray-600 outline-none focus:border-pink-500 text-sm"
                  >
                    {CX_FEEDBACK_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Priority Level:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'high', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTicketPriority(p)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                        newTicketPriority === p
                          ? p === 'urgent'
                            ? 'bg-red-600 text-white shadow-md'
                            : p === 'high'
                            ? 'bg-orange-600 text-white shadow-md'
                            : 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-700 text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  {isCXPortal ? 'Customer Feedback / Issue Description:' : 'Problem Description:'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={newTicketProblem}
                  onChange={(e) => setNewTicketProblem(e.target.value)}
                  placeholder={
                    isCXPortal 
                      ? "Describe guest feedback or observed condition (e.g. cabin AC warm, seat belt stuck, harness sensor alert, ride rattling, sound clipping)..."
                      : "Describe the issue (e.g. sound sensor loose, hydraulic pressure error, emergency stop switch error)..."
                  }
                  className={`w-full bg-gray-700 text-white rounded-xl p-3 border border-gray-600 outline-none text-sm placeholder-gray-400 resize-none ${
                    isCXPortal ? 'focus:border-pink-500' : 'focus:border-red-500'
                  }`}
                />
              </div>

              {isCXPortal && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-pink-400" />
                    <span>Guest Details / Cabin / Seat # (Optional):</span>
                  </label>
                  <input
                    type="text"
                    value={newTicketGuestDetails}
                    onChange={(e) => setNewTicketGuestDetails(e.target.value)}
                    placeholder="e.g. Guest Cabin #4 / Seat 2B / Family of 4 feedback"
                    className="w-full bg-gray-700 text-white rounded-xl p-3 border border-gray-600 outline-none focus:border-pink-500 text-sm placeholder-gray-400"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 ${
                    isCXPortal
                      ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-pink-900/40'
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-red-900/40'
                  }`}
                >
                  {isCXPortal ? 'Dispatch to Maintenance' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceDashboard;
