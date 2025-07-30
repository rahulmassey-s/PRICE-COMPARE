"use client";
import * as React from 'react';
import { AppBar, Box, CssBaseline, Divider, Drawer, IconButton, List, ListItem, ListItemIcon, ListItemText, Toolbar, Typography, useTheme, Button, TextField, CircularProgress, Alert, Tabs, Tab, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, ListItemButton, Checkbox, List as MUIList, ListItem as MUIListItem, ListItemText as MUIListItemText, ListSubheader, Radio, RadioGroup, FormControlLabel, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import HistoryIcon from '@mui/icons-material/History';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import BarChartIcon from '@mui/icons-material/BarChart';
import { DataGrid } from '@mui/x-data-grid';
import { MouseEvent } from 'react';
import { BarChart, PieChart } from '@mui/x-charts';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import Snackbar from '@mui/material/Snackbar';
import Backdrop from '@mui/material/Backdrop';
import InfoIcon from '@mui/icons-material/Info';
import { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, query, orderBy, limit, onSnapshot, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import Tooltip from '@mui/material/Tooltip';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

const drawerWidth = 240;

// Helper function to get backend URL
const getBackendUrl = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:4000';
  }
  return 'https://sbhs-notification-backend.onrender.com';
};

const daysOfWeekList = [
  { key: 'sun', label: 'Sun' },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
];

export default function AdminDashboard() {
  // Add target state for segment selection FIRST
  const [target, setTarget] = React.useState<'all' | 'members' | 'non-members'>('all');
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const theme = useTheme();
  const [tab, setTab] = React.useState(0);
  const [sendTab, setSendTab] = React.useState(0); // 0 = Send to User, 1 = Broadcast to All

  // Notification form state
  const [userId, setUserId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState("");
  const [error, setError] = React.useState("");

  // Add new state for image and action buttons
  const [image, setImage] = React.useState("");
  const [action1Label, setAction1Label] = React.useState("");
  const [action1Url, setAction1Url] = React.useState("");
  const [action2Label, setAction2Label] = React.useState("");
  const [action2Url, setAction2Url] = React.useState("");

  // User Segments state
  const [segments, setSegments] = React.useState([
    { id: 1, name: 'All Users', description: 'All registered users', userCount: 120 },
    { id: 2, name: 'Active Users', description: 'Users active in last 30 days', userCount: 80 },
    { id: 3, name: 'Premium Members', description: 'Subscribed to premium', userCount: 15 },
  ]);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [newSegmentName, setNewSegmentName] = React.useState('');
  const [newSegmentDesc, setNewSegmentDesc] = React.useState('');

  // Settings state
  const [copyMsg, setCopyMsg] = React.useState('');
  const vapidPublic = 'BGXHg--WeZMqYNMq2s0FXlqadvZ6FHHStWAaKwSgvODfRhq12XD5C0RrcptIR8kAEGyEzr-Mtd2m_5Hii2l5FMQ';
  const vapidPrivate = 'odUv94zKw06j3UybhFFPH0A6eCD5LPH1VMctTX9L6w8';
  const firebaseConfig = '{"type":"service_account",...}';

  const [darkMode, setDarkMode] = React.useState(false);
  const muiTheme = React.useMemo(() => createTheme({
    palette: { mode: darkMode ? 'dark' : 'light' },
  }), [darkMode]);

  // Snackbar state
  const [snackbar, setSnackbar] = React.useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const showSnackbar = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCopy = (val: string) => {
    navigator.clipboard.writeText(val);
    showSnackbar('Copied!', 'success');
    setTimeout(() => setCopyMsg(''), 1500);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTab(newValue);
    setSuccess("");
    setError("");
  };

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<null | (() => void)>(null);
  const [confirmMsg, setConfirmMsg] = React.useState('');

  const handleConfirm = (msg: string, action: () => void) => {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
    setConfirmOpen(true);
  };

  // --- Add validation state ---
  const [formErrors, setFormErrors] = React.useState<any>({});

  // --- Add notification preview state (no extra state needed, use form fields) ---

  // --- Scheduling state ---
  const [sendMode, setSendMode] = React.useState<'now' | 'schedule'>('now');
  const [scheduledAt, setScheduledAt] = React.useState<Date | null>(null);

  // --- Validation function ---
  function validateNotificationForm() {
    const errors: any = {};
    if (!title.trim()) errors.title = 'Title is required.';
    if (!body.trim()) errors.body = 'Body is required.';
    if (icon && (!/^https:\/\//.test(icon) || !icon.match(/\.(png|jpg|jpeg|ico|svg)$/i))) errors.icon = 'Icon URL must be HTTPS and an image.';
    if (image && (!/^https:\/\//.test(image) || !image.match(/\.(png|jpg|jpeg|webp)$/i))) errors.image = 'Image URL must be HTTPS and an image.';
    if (url && !/^https:\/\//.test(url)) errors.url = 'URL must be HTTPS.';
    if ((action1Label || action1Url) && (!action1Label.trim() || !/^https:\/\//.test(action1Url))) errors.action1 = 'Action 1 requires a label and a valid HTTPS URL.';
    if ((action2Label || action2Url) && (!action2Label.trim() || !/^https:\/\//.test(action2Url))) errors.action2 = 'Action 2 requires a label and a valid HTTPS URL.';
    if (userId && !userId.trim()) errors.userId = 'User ID is required.';
    if (sendMode === 'schedule') {
      if (!scheduledAt) errors.scheduledAt = 'Schedule date/time is required.';
      else if (scheduledAt.getTime() < Date.now()) errors.scheduledAt = 'Schedule time must be in the future.';
    }
    return errors;
  }

  // --- Add user selection state ---
  const [memberUsers, setMemberUsers] = React.useState<any[]>([]);
  const [nonMemberUsers, setNonMemberUsers] = React.useState<any[]>([]);
  const [selectedMemberUids, setSelectedMemberUids] = React.useState<string[]>([]);
  const [selectedNonMemberUids, setSelectedNonMemberUids] = React.useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = React.useState(false);

  // --- Fetch users by role when target changes ---
  React.useEffect(() => {
    if (tab !== 0) return;
    if (target === 'members' || target === 'non-members') {
      setLoadingUsers(true);
      import('@/lib/firebase/client').then(({ db, collection, query, where, getDocs }) => {
        const fetchUsers = async (role: string) => {
          const q = query(collection(db, 'users'), where('role', '==', role));
          const snap = await getDocs(q);
          return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        };
        Promise.all([
          fetchUsers('member'),
          fetchUsers('non-member')
        ]).then(([members, nonMembers]) => {
          setMemberUsers(members);
          setNonMemberUsers(nonMembers);
          setLoadingUsers(false);
        });
      });
    }
  }, [tab, target]);

  // --- Handle select all/individual users ---
  const handleSelectAllMembers = (checked: boolean) => {
    setSelectedMemberUids(checked ? memberUsers.map(u => u.uid) : []);
  };
  const handleSelectAllNonMembers = (checked: boolean) => {
    setSelectedNonMemberUids(checked ? nonMemberUsers.map(u => u.uid) : []);
  };
  const handleToggleMember = (uid: string) => {
    setSelectedMemberUids(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };
  const handleToggleNonMember = (uid: string) => {
    setSelectedNonMemberUids(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
  };

  // --- Update handleSendToUser/All to use selected UIDs for segments ---
  const handleSendToSegment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateNotificationForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    let userIds: string[] = [];
    if (target === 'members') userIds = selectedMemberUids;
    if (target === 'non-members') userIds = selectedNonMemberUids;
    if (userIds.length === 0) {
      showSnackbar('Please select at least one user.', 'error');
      return;
    }
    handleConfirm(`Are you sure you want to send this notification to ${userIds.length} user(s)?`, async () => {
      setConfirmOpen(false);
      setLoading(true);
      setSuccess("");
      setError("");
      for (const userId of userIds) {
        try {
          const actions = [];
          if (action1Label && action1Url) actions.push({ action: action1Label, title: action1Label, url: action1Url });
          if (action2Label && action2Url) actions.push({ action: action2Label, title: action2Label, url: action2Url });
          const payload = {
            userId,
            title,
            body,
            icon,
            url,
            image,
            actions,
            ...(sendMode === 'schedule' && { scheduledAt: scheduledAt?.toISOString() }),
          };
          if (sendMode === 'schedule') {
            // Schedule for later: save to Firestore, do not send now
            const res = await fetch(`${getBackendUrl()}/schedule-notification`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
              showSnackbar('Notification scheduled!', 'success');
            } else {
              showSnackbar(data.message || 'Failed to schedule notification.', 'error');
            }
          } else {
            const res = await fetch(`${getBackendUrl()}/send-notification`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
              showSnackbar('Notification sent to user!', 'success');
            } else {
              showSnackbar(data.message || "Failed to send notification.", 'error');
            }
          }
        } catch (err) {
          showSnackbar("Network error. Please try again.", 'error');
        }
      }
      setTitle("");
      setBody("");
      setIcon("");
      setUrl("");
      setImage("");
      setAction1Label("");
      setAction1Url("");
      setAction2Label("");
      setAction2Url("");
      setSelectedMemberUids([]);
      setSelectedNonMemberUids([]);
      setLoading(false);
    });
  };

  const handleSendToAll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateNotificationForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    handleConfirm('Are you sure you want to broadcast this notification to all users?', async () => {
      setConfirmOpen(false);
      setLoading(true);
      setSuccess("");
      setError("");
      try {
        const actions = [];
        if (action1Label && action1Url) actions.push({ action: action1Label, title: action1Label, url: action1Url });
        if (action2Label && action2Url) actions.push({ action: action2Label, title: action2Label, url: action2Url });
        const payload = {
          title,
          body,
          icon,
          url,
          image,
          actions,
          ...(sendMode === 'schedule' && { scheduledAt: scheduledAt?.toISOString() }),
        };
        if (sendMode === 'schedule') {
          // Schedule for later: save to Firestore, do not send now
          const res = await fetch(`${getBackendUrl()}/schedule-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            showSnackbar('Notification scheduled!', 'success');
          } else {
            showSnackbar(data.message || 'Failed to schedule notification.', 'error');
          }
        } else {
          const res = await fetch(`${getBackendUrl()}/send-to-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            showSnackbar(`Broadcast sent! Message: ${data.message}`, 'success');
            setTitle("");
            setBody("");
            setIcon("");
            setUrl("");
            setImage("");
            setAction1Label("");
            setAction1Url("");
            setAction2Label("");
            setAction2Url("");
          } else {
            showSnackbar(data.message || "Failed to send broadcast.", 'error');
          }
        }
      } catch (err) {
        showSnackbar("Network error. Please try again.", 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSendToUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateNotificationForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    handleConfirm('Are you sure you want to send this notification to the user?', async () => {
      setConfirmOpen(false);
      setLoading(true);
      setSuccess("");
      setError("");
      try {
        const actions = [];
        if (action1Label && action1Url) actions.push({ action: action1Label, title: action1Label, url: action1Url });
        if (action2Label && action2Url) actions.push({ action: action2Label, title: action2Label, url: action2Url });
        const payload = {
          userId,
          title,
          body,
          icon,
          url,
          image,
          actions,
          ...(sendMode === 'schedule' && { scheduledAt: scheduledAt?.toISOString() }),
        };
        if (sendMode === 'schedule') {
          // Schedule for later: save to Firestore, do not send now
                      const res = await fetch(`${getBackendUrl()}/schedule-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            showSnackbar('Notification scheduled!', 'success');
          } else {
            showSnackbar(data.message || 'Failed to schedule notification.', 'error');
          }
        } else {
                      const res = await fetch(`${getBackendUrl()}/send-notification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            showSnackbar('Notification sent to user!', 'success');
            setUserId("");
            setTitle("");
            setBody("");
            setIcon("");
            setUrl("");
            setImage("");
            setAction1Label("");
            setAction1Url("");
            setAction2Label("");
            setAction2Url("");
          } else {
            showSnackbar(data.message || "Failed to send notification.", 'error');
          }
        }
      } catch (err) {
        showSnackbar("Network error. Please try again.", 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  const handleAddSegment = () => {
    if (newSegmentName.trim()) {
      setSegments([...segments, {
        id: segments.length + 1,
        name: newSegmentName,
        description: newSegmentDesc,
        userCount: 0,
      }]);
      showSnackbar('Segment added!', 'success');
      setNewSegmentName('');
      setNewSegmentDesc('');
      setAddDialogOpen(false);
    }
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap>
          Admin Dashboard
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        <ListItem>
          <ListItemButton selected={tab === 0} onClick={() => setTab(0)}>
            <ListItemIcon><NotificationsIcon /></ListItemIcon>
            <ListItemText primary="Send Notification" />
          </ListItemButton>
        </ListItem>
        <ListItem>
          <ListItemButton selected={tab === 1} onClick={() => setTab(1)}>
            <ListItemIcon><HistoryIcon /></ListItemIcon>
            <ListItemText primary="Notification History" />
          </ListItemButton>
        </ListItem>
        <ListItem>
          <ListItemButton selected={tab === 2} onClick={() => setTab(2)}>
            <ListItemIcon><GroupIcon /></ListItemIcon>
            <ListItemText primary="User Segments" />
          </ListItemButton>
        </ListItem>
        <ListItem>
          <ListItemButton selected={tab === 3} onClick={() => setTab(3)}>
            <ListItemIcon><BarChartIcon /></ListItemIcon>
            <ListItemText primary="Analytics" />
          </ListItemButton>
        </ListItem>
        <ListItem>
          <ListItemButton selected={tab === 4} onClick={() => setTab(4)}>
            <ListItemIcon><SettingsIcon /></ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  // --- Notification History State (Firestore, Real-time) ---
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  useEffect(() => {
    if (tab !== 1) return;
    setHistoryLoading(true);
    setHistoryError('');
    console.log('Loading notification history...');
    // Use onSnapshot for real-time updates
    const q = query(collection(db, 'notifications'), orderBy('sentAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      console.log('Notification history snapshot:', snap.docs.length, 'documents');
      const rows = snap.docs.map((doc, idx) => {
        const d = doc.data();
        console.log('Document data:', doc.id, d);
        let dateStr = '';
        if (d.sentAt) {
          if (d.sentAt.toDate) dateStr = d.sentAt.toDate().toLocaleString();
        } else if (d.sentAt.seconds) {
          dateStr = new Date(d.sentAt.seconds * 1000).toLocaleString();
        } else {
          dateStr = new Date(d.sentAt).toLocaleString();
        }
        return {
          id: doc.id,
          date: dateStr,
          title: d.title || '',
          body: d.body || '',
          status: d.status || '',
          user: d.userId || (d.type === 'broadcast' ? 'All Users' : ''),
          type: d.type || 'notification',
        };
      });
      console.log('Processed rows:', rows);
      setHistoryRows(rows);
      setHistoryLoading(false);
    }, (e) => {
      console.error('Notification history error:', e);
      setHistoryError('Failed to load notification logs.');
      setHistoryLoading(false);
    });
    return () => unsubscribe();
  }, [tab]);

  // --- Filtered Rows ---
  const filteredHistoryRows = historyRows.filter(row =>
    row.title.toLowerCase().includes(historySearch.toLowerCase()) ||
    row.body.toLowerCase().includes(historySearch.toLowerCase()) ||
    row.user.toLowerCase().includes(historySearch.toLowerCase()) ||
    row.status.toLowerCase().includes(historySearch.toLowerCase())
  );

  // --- Scheduled Notifications State ---
  const [scheduledRows, setScheduledRows] = useState<any[]>([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduledError, setScheduledError] = useState('');

  useEffect(() => {
    if (tab !== 2) return;
    setScheduledLoading(true);
    setScheduledError('');
    // Use onSnapshot for real-time updates
    const q = query(collection(db, 'scheduled_notifications'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((doc, idx) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title || '',
          body: d.body || '',
          segment: d.segment || 'all',
          scheduledAt: d.scheduledAt && d.scheduledAt.toDate ? d.scheduledAt.toDate().toLocaleString() : (d.scheduledAt ? new Date(d.scheduledAt).toLocaleString() : ''),
          status: d.status || '',
        };
      });
      setScheduledRows(rows);
      setScheduledLoading(false);
    }, (e) => {
      setScheduledError('Failed to load scheduled notifications.');
      setScheduledLoading(false);
    });
    return () => unsubscribe();
  }, [tab]);

  // Dummy analytics data
  const analyticsData = {
    sent: 120,
    delivered: 100,
    failed: 10,
    clicked: 30,
  };

  // In the confirmation dialog state
  const confirmButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (confirmOpen && confirmButtonRef.current) {
      confirmButtonRef.current.focus();
    }
  }, [confirmOpen]);

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && confirmAction) {
      confirmAction();
    } else if (e.key === 'Escape') {
      setConfirmOpen(false);
    }
  };

  // Help dialog state
  const [helpOpen, setHelpOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === '/') {
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Cloudinary config (replace with your own values) ---
  const CLOUDINARY_CLOUD_NAME = 'dvgilt12w';
  const CLOUDINARY_UPLOAD_PRESET = 'ml_default';

  // --- Image upload state ---
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');

  // --- Image upload handler ---
  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setImage(data.secure_url);
      } else {
        setUploadError('Upload failed.');
      }
    } catch (err) {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  // --- Journey Builder State ---
  const [journeyTab, setJourneyTab] = React.useState(0); // 0 = Send, 1 = History, 2 = Scheduled, 3 = Segments, 4 = Analytics, 5 = Settings, 6 = Journeys
  const [journeyName, setJourneyName] = React.useState('');
  const [journeySteps, setJourneySteps] = React.useState<Array<{
    title: string;
    body: string;
    image: string;
    uploading: boolean;
    uploadError: string;
    delay: number;
    delayUnit: string;
    segment: string;
    daysOfWeek: string[];
    timesOfDay: string[];
  }>>([
    { title: '', body: '', image: '', uploading: false, uploadError: '', delay: 10, delayUnit: 'min', segment: 'all', daysOfWeek: [], timesOfDay: ['08:00'] }
  ]);

  function handleJourneyStepChange(idx: number, field: string, value: any) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  }
  function handleJourneyStepImage(idx: number, file: File) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? { ...s, uploading: true, uploadError: '' } : s));
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        setJourneySteps(steps => steps.map((s, i) => i === idx ? { ...s, image: data.secure_url || '', uploading: false, uploadError: data.secure_url ? '' : 'Upload failed.' } : s));
      })
      .catch(() => {
        setJourneySteps(steps => steps.map((s, i) => i === idx ? { ...s, uploading: false, uploadError: 'Upload failed.' } : s));
      });
  }
  function addJourneyStep() {
    setJourneySteps(steps => [...steps, { title: '', body: '', image: '', uploading: false, uploadError: '', delay: 10, delayUnit: 'min', segment: 'all', daysOfWeek: [], timesOfDay: ['08:00'] }]);
  }
  function removeJourneyStep(idx: number) {
    setJourneySteps(steps => steps.filter((_, i) => i !== idx));
  }
  function moveJourneyStep(idx: number, dir: -1 | 1) {
    setJourneySteps(steps => {
      const arr = [...steps];
      const [removed] = arr.splice(idx, 1);
      arr.splice(idx + dir, 0, removed);
      return arr;
    });
  }
  function handleJourneyStepDays(idx: number, day: string) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? {
      ...s,
      daysOfWeek: s.daysOfWeek.includes(day)
        ? s.daysOfWeek.filter(d => d !== day)
        : [...s.daysOfWeek, day]
    } : s));
  }
  function handleJourneyStepTime(idx: number, timeIdx: number, value: string) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? {
      ...s,
      timesOfDay: s.timesOfDay.map((t, j) => j === timeIdx ? value : t)
    } : s));
  }
  function addJourneyStepTime(idx: number) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? {
      ...s,
      timesOfDay: [...s.timesOfDay, '08:00']
    } : s));
  }
  function removeJourneyStepTime(idx: number, timeIdx: number) {
    setJourneySteps(steps => steps.map((s, i) => i === idx ? {
      ...s,
      timesOfDay: s.timesOfDay.filter((_, j) => j !== timeIdx)
    } : s));
  }
  async function handleJourneySubmit(e: React.FormEvent) {
    e.preventDefault();
    // Calculate scheduledAt for each step (relative delays)
    let now = new Date();
    const stepsWithTime = journeySteps.map((step, i) => {
      let ms = step.delay * (step.delayUnit === 'min' ? 60000 : step.delayUnit === 'hr' ? 3600000 : 86400000);
      now = new Date(now.getTime() + ms);
      return {
        ...step,
        scheduledAt: now.toISOString(),
        delay: step.delay,
        delayUnit: step.delayUnit,
        daysOfWeek: step.daysOfWeek,
        timesOfDay: step.timesOfDay,
      };
    });
    try {
              const res = await fetch(`${getBackendUrl()}/schedule-journey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: journeyName, steps: stepsWithTime }),
      });
      const data = await res.json();
      if (data.success) {
        setJourneyName('');
        setJourneySteps([{ title: '', body: '', image: '', uploading: false, uploadError: '', delay: 10, delayUnit: 'min', segment: 'all', daysOfWeek: [], timesOfDay: ['08:00'] }]);
        showSnackbar('Journey scheduled!', 'success');
      } else {
        showSnackbar(data.message || 'Failed to schedule journey.', 'error');
      }
    } catch (err) {
      showSnackbar('Network error. Please try again.', 'error');
    }
  }

  // --- Active Journeys State ---
  const [activeJourneys, setActiveJourneys] = React.useState<any[]>([]);
  const [activeJourneysLoading, setActiveJourneysLoading] = React.useState(false);
  const [activeJourneysError, setActiveJourneysError] = React.useState('');

  useEffect(() => {
    if (tab !== 7) return;
    setActiveJourneysLoading(true);
    setActiveJourneysError('');
    const q = query(collection(db, 'scheduled_notifications'), where('type', '==', 'journey'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snap) => {
      // Group by journeyName
      const grouped: Record<string, any[]> = {};
      snap.docs.forEach(doc => {
        const d = doc.data();
        if (!grouped[d.journeyName]) grouped[d.journeyName] = [];
        grouped[d.journeyName].push({ ...d, id: doc.id });
      });
      // Prepare summary rows
      const rows = Object.entries(grouped).map(([name, steps]) => {
        const pendingSteps = steps.length;
        const totalSteps = steps.length; // (if you want to show total, need to fetch all steps, for now pending = total)
        const nextScheduled = steps.reduce((min, s) => (!min || (s.scheduledAt && s.scheduledAt.toDate && s.scheduledAt.toDate() < min) ? s.scheduledAt.toDate() : min), null);
        return {
          journeyName: name,
          totalSteps,
          pendingSteps,
          nextScheduled: nextScheduled ? nextScheduled.toLocaleString() : '',
          status: pendingSteps > 0 ? 'Active' : 'Completed',
        };
      });
      setActiveJourneys(rows);
      setActiveJourneysLoading(false);
    }, (e) => {
      setActiveJourneysError('Failed to load active journeys.');
      setActiveJourneysLoading(false);
    });
    return () => unsubscribe();
  }, [tab]);

  async function handleStopJourney(journeyName: string) {
    try {
      await updateDoc(doc(db, 'journeys', journeyName), { active: false });
      // Cancel all pending steps for this journey
      const q = query(collection(db, 'scheduled_notifications'), where('journeyName', '==', journeyName), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        batch.update(docSnap.ref, { status: 'cancelled' });
      });
      await batch.commit();
      showSnackbar('Journey stopped and pending steps cancelled!', 'success');
    } catch (err) {
      showSnackbar('Failed to stop journey.', 'error');
    }
  }

  const [inactiveTab, setInactiveTab] = React.useState(0);
  const [inactiveDuration, setInactiveDuration] = React.useState(3);
  const [inactiveUnit, setInactiveUnit] = React.useState('days');
  const [inactiveTitle, setInactiveTitle] = React.useState('');
  const [inactiveBody, setInactiveBody] = React.useState('');
  const [inactiveImage, setInactiveImage] = React.useState('');
  const [inactiveUploading, setInactiveUploading] = React.useState(false);
  const [inactiveUploadError, setInactiveUploadError] = React.useState('');
  const [inactiveUrl, setInactiveUrl] = React.useState('');
  const [inactiveSegment, setInactiveSegment] = React.useState('all');
  const [inactiveDays, setInactiveDays] = React.useState<string[]>([]);
  const [inactiveTimes, setInactiveTimes] = React.useState<string[]>(['08:00']);
  function handleInactiveDay(day: string) {
    setInactiveDays(days => days.includes(day) ? days.filter(d => d !== day) : [...days, day]);
  }
  function handleInactiveTime(idx: number, value: string) {
    setInactiveTimes(times => times.map((t, i) => i === idx ? value : t));
  }
  function addInactiveTime() {
    setInactiveTimes(times => [...times, '08:00']);
  }
  function removeInactiveTime(idx: number) {
    setInactiveTimes(times => times.filter((_, i) => i !== idx));
  }
  async function handleInactiveImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInactiveUploading(true);
    setInactiveUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setInactiveImage(data.secure_url);
      } else {
        setInactiveUploadError('Upload failed.');
      }
    } catch (err) {
      setInactiveUploadError('Upload failed.');
    } finally {
      setInactiveUploading(false);
    }
  }
  async function handleInactiveSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
              const res = await fetch(`${getBackendUrl()}/schedule-inactive-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inactiveDuration,
          inactiveUnit,
          inactiveTitle,
          inactiveBody,
          inactiveImage,
          inactiveUrl,
          inactiveSegment,
          inactiveDays,
          inactiveTimes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInactiveTitle('');
        setInactiveBody('');
        setInactiveImage('');
        setInactiveUrl('');
        setInactiveDays([]);
        setInactiveTimes(['08:00']);
        showSnackbar('Inactive campaign scheduled!', 'success');
      } else {
        showSnackbar(data.message || 'Failed to schedule inactive campaign.', 'error');
      }
    } catch (err) {
      showSnackbar('Network error. Please try again.', 'error');
    }
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Backdrop sx={{ color: '#fff', zIndex: muiTheme.zIndex.drawer + 2000 }} open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap component="div">
              Notification Admin Dashboard
            </Typography>
            <Box sx={{ flexGrow: 1 }} />
            <IconButton color="inherit" onClick={() => setHelpOpen(true)}>
              <InfoIcon />
            </IconButton>
            <IconButton color="inherit" onClick={() => setDarkMode(m => !m)}>
              {darkMode ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box
          component="nav"
          sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
          aria-label="mailbox folders"
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
        <Box
          component="main"
          sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}
        >
          <Toolbar />
          <Tabs value={tab} onChange={handleTabChange} aria-label="admin dashboard tabs" variant="scrollable" scrollButtons="auto">
            <Tab label="Send Notification" />
            <Tab label="Notification History" />
            <Tab label="Scheduled Notifications" />
            <Tab label="User Segments" />
            <Tab label="Analytics" />
            <Tab label="Settings" />
            <Tab label="Journeys" />
            <Tab label="Active Journeys" />
            <Tab label="Inactive Campaign" />
          </Tabs>

          {/* Tab Panels */}
          {tab === 0 && (
            <Paper sx={{ maxWidth: 600, p: 3, mb: 2 }} elevation={3}>
              <Tabs value={sendTab} onChange={(_, v) => setSendTab(v)}>
                <Tab label="Send to User" />
                <Tab label="Broadcast to All" />
              </Tabs>
              {sendTab === 0 && (
                <Tooltip title="Firebase UID of the user to send notification to.">
                  <TextField
                    label="User ID (Firebase UID)"
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    fullWidth
                    margin="normal"
                    required
                    error={!!formErrors.userId}
                    helperText={formErrors.userId}
                  />
                </Tooltip>
              )}
              {sendTab === 1 && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Tabs value={target} onChange={(_, v) => setTarget(v)} aria-label="segment tabs">
                      <Tab label="All Users" value="all" />
                      <Tab label="Members" value="members" />
                      <Tab label="Non-Members" value="non-members" />
                    </Tabs>
                  </Box>
                  {(target === 'members' || target === 'non-members') && (
                    <Paper sx={{ mt: 2, mb: 2, p: 2, maxHeight: 300, overflow: 'auto' }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>{target === 'members' ? 'Members' : 'Non-Members'} List</Typography>
                      {loadingUsers ? <CircularProgress size={24} /> : (
                        <MUIList dense>
                          <MUIListItem key="select-all">
                            <Checkbox
                              checked={target === 'members' ? selectedMemberUids.length === memberUsers.length && memberUsers.length > 0 : selectedNonMemberUids.length === nonMemberUsers.length && nonMemberUsers.length > 0}
                              indeterminate={target === 'members' ? selectedMemberUids.length > 0 && selectedMemberUids.length < memberUsers.length : selectedNonMemberUids.length > 0 && selectedNonMemberUids.length < nonMemberUsers.length}
                              onChange={e => target === 'members' ? handleSelectAllMembers(e.target.checked) : handleSelectAllNonMembers(e.target.checked)}
                            />
                            <MUIListItemText primary="Select All" />
                          </MUIListItem>
                          {(target === 'members' ? memberUsers : nonMemberUsers).map(user => (
                            <MUIListItem key={user.uid}>
                              <Checkbox
                                checked={target === 'members' ? selectedMemberUids.includes(user.uid) : selectedNonMemberUids.includes(user.uid)}
                                onChange={() => target === 'members' ? handleToggleMember(user.uid) : handleToggleNonMember(user.uid)}
                              />
                              <MUIListItemText primary={user.displayName || user.email || user.uid} secondary={user.email} />
                            </MUIListItem>
                          ))}
                        </MUIList>
                      )}
                    </Paper>
                  )}
                </>
              )}
              <Box sx={{ mb: 2 }}>
                <Tabs value={target} onChange={(_, v) => setTarget(v)} aria-label="segment tabs">
                  <Tab label="All Users" value="all" />
                  <Tab label="Members" value="members" />
                  <Tab label="Non-Members" value="non-members" />
                </Tabs>
              </Box>
              <Box component="form" onSubmit={
                sendTab === 0 ? handleSendToUser :
                (target === 'members' || target === 'non-members') ? handleSendToSegment :
                handleSendToAll
              } sx={{ mt: 2 }}>
                {sendTab === 0 && (
                  <Tooltip title="Firebase UID of the user to send notification to.">
                    <TextField
                      label="User ID (Firebase UID)"
                      value={userId}
                      onChange={e => setUserId(e.target.value)}
                      fullWidth
                      margin="normal"
                      required
                      error={!!formErrors.userId}
                      helperText={formErrors.userId}
                    />
                  </Tooltip>
                )}
                <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                  <RadioGroup row value={sendMode} onChange={e => setSendMode(e.target.value as 'now' | 'schedule')}>
                    <FormControlLabel value="now" control={<Radio />} label="Send Now" />
                    <FormControlLabel value="schedule" control={<Radio />} label="Schedule for Later" />
                  </RadioGroup>
                  {sendMode === 'schedule' && (
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DateTimePicker
                        label="Schedule Date & Time"
                        value={scheduledAt}
                        onChange={setScheduledAt}
                        minDateTime={new Date()}
                        minutesStep={1}
                        slotProps={{ textField: { size: 'small', sx: { minWidth: 220 } } }}
                      />
                    </LocalizationProvider>
                  )}
                </Box>
                <Tooltip title="Notification title (required)">
                  <TextField
                    label="Notification Title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    fullWidth
                    margin="normal"
                    required
                    error={!!formErrors.title}
                    helperText={formErrors.title}
                  />
                </Tooltip>
                <Tooltip title="Notification body/message (required)">
                  <TextField
                    label="Notification Body"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    fullWidth
                    margin="normal"
                    multiline
                    rows={3}
                    required
                    error={!!formErrors.body}
                    helperText={formErrors.body}
                  />
                </Tooltip>
                <Tooltip title="HTTPS image URL for notification icon (optional)">
                  <TextField
                    label="Icon URL (Optional)"
                    value={icon}
                    onChange={e => setIcon(e.target.value)}
                    fullWidth
                    margin="normal"
                    error={!!formErrors.icon}
                    helperText={formErrors.icon}
                  />
                </Tooltip>
                <Tooltip title="HTTPS URL to open when notification is clicked (optional)">
                  <TextField
                    label="URL to Open on Click (Optional)"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    fullWidth
                    margin="normal"
                    error={!!formErrors.url}
                    helperText={formErrors.url}
                  />
                </Tooltip>
                <Box sx={{ mb: 2 }}>
                  <Button variant="outlined" component="label" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload Image'}
                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                  </Button>
                  {uploadError && <Typography color="error" variant="caption">{uploadError}</Typography>}
                  {image && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption">Preview:</Typography>
                      <img src={image} alt="Preview" style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }} />
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Tooltip title="Action button label (optional)">
                    <TextField
                      label="Action 1 Label"
                      value={action1Label}
                      onChange={e => setAction1Label(e.target.value)}
                      fullWidth
                      margin="normal"
                      error={!!formErrors.action1}
                      helperText={formErrors.action1}
                    />
                  </Tooltip>
                  <Tooltip title="HTTPS URL for action button (optional)">
                    <TextField
                      label="Action 1 URL"
                      value={action1Url}
                      onChange={e => setAction1Url(e.target.value)}
                      fullWidth
                      margin="normal"
                      error={!!formErrors.action1}
                      helperText={formErrors.action1}
                    />
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                  <Tooltip title="Action button label (optional)">
                    <TextField
                      label="Action 2 Label"
                      value={action2Label}
                      onChange={e => setAction2Label(e.target.value)}
                      fullWidth
                      margin="normal"
                      error={!!formErrors.action2}
                      helperText={formErrors.action2}
                    />
                  </Tooltip>
                  <Tooltip title="HTTPS URL for action button (optional)">
                    <TextField
                      label="Action 2 URL"
                      value={action2Url}
                      onChange={e => setAction2Url(e.target.value)}
                      fullWidth
                      margin="normal"
                      error={!!formErrors.action2}
                      helperText={formErrors.action2}
                    />
                  </Tooltip>
                </Box>
                {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={loading || Object.keys(formErrors).length > 0}
                    startIcon={loading && <CircularProgress size={20} />}
                  >
                    {sendTab === 0 ? 'Send to User' : 'Send to All Users'}
                  </Button>
                </Box>
              </Box>
              {/* --- Live Preview Card --- */}
              <Paper sx={{ maxWidth: 400, mt: 3, mb: 2, p: 2, border: '1px solid #eee' }} elevation={1}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>Live Notification Preview</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  {icon && /^https:\/\//.test(icon) && <img src={icon} alt="icon" style={{ width: 40, height: 40, marginRight: 8, borderRadius: 8 }} />}
                  <Box>
                    <Typography variant="h6">{title || 'Notification Title'}</Typography>
                    <Typography variant="body2">{body || 'Notification body goes here.'}</Typography>
                  </Box>
                </Box>
                {image && /^https:\/\//.test(image) && <img src={image} alt="big" style={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  {action1Label && action1Url && /^https:\/\//.test(action1Url) && <Button size="small" variant="outlined">{action1Label}</Button>}
                  {action2Label && action2Url && /^https:\/\//.test(action2Url) && <Button size="small" variant="outlined">{action2Label}</Button>}
                </Box>
                {sendMode === 'schedule' && scheduledAt && (
                  <Typography variant="caption" color="primary">Scheduled for: {scheduledAt.toLocaleString()}</Typography>
                )}
              </Paper>
            </Paper>
          )}
          {tab === 1 && (
            <Box p={2}>
              <Typography variant="h6" gutterBottom>Notification History</Typography>
              <TextField
                label="Search History"
                variant="outlined"
                size="small"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                sx={{ mb: 2, width: 300 }}
              />
              {historyLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: 200 }}><CircularProgress /></Box>
              ) : historyError ? (
                <Alert severity="error">{historyError}</Alert>
              ) : (
                <div style={{ height: 400, width: '100%' }}>
                  <DataGrid
                    rows={filteredHistoryRows}
                    columns={[
                      { field: 'date', headerName: 'Date', width: 160 },
                      { field: 'title', headerName: 'Title', width: 180 },
                      { field: 'body', headerName: 'Body', width: 260 },
                      { field: 'status', headerName: 'Status', width: 120 },
                      { field: 'user', headerName: 'User', width: 140 },
                    ]}
                    pageSizeOptions={[5, 10, 20]}
                    initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
                    disableRowSelectionOnClick
                    sx={{ background: 'background.paper' }}
                  />
                </div>
              )}
            </Box>
          )}
          {tab === 2 && (
            <Box p={2}>
              <Typography variant="h6" gutterBottom>Scheduled Notifications</Typography>
              {scheduledLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: 200 }}><CircularProgress /></Box>
              ) : scheduledError ? (
                <Alert severity="error">{scheduledError}</Alert>
              ) : (
                <div style={{ height: 400, width: '100%' }}>
                  <DataGrid
                    rows={scheduledRows}
                    columns={[
                      { field: 'title', headerName: 'Title', width: 180 },
                      { field: 'body', headerName: 'Body', width: 260 },
                      { field: 'segment', headerName: 'Segment', width: 120 },
                      { field: 'scheduledAt', headerName: 'Scheduled Time', width: 180 },
                      { field: 'status', headerName: 'Status', width: 120 },
                    ]}
                    pageSizeOptions={[5, 10, 20]}
                    initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
                    disableRowSelectionOnClick
                    sx={{ background: 'background.paper' }}
                  />
                </div>
              )}
            </Box>
          )}
          {tab === 2 && (
            <Paper sx={{ maxWidth: 700, p: 3, mb: 2 }} elevation={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">User Segments</Typography>
                <Button variant="contained" onClick={() => setAddDialogOpen(true)}>Add Segment</Button>
              </Box>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">User Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {segments.map(seg => (
                      <TableRow key={seg.id}>
                        <TableCell>{seg.name}</TableCell>
                        <TableCell>{seg.description}</TableCell>
                        <TableCell align="right">{seg.userCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)}>
                <DialogTitle>Add New Segment</DialogTitle>
                <DialogContent>
                  <TextField
                    label="Segment Name"
                    value={newSegmentName}
                    onChange={e => setNewSegmentName(e.target.value)}
                    fullWidth
                    margin="normal"
                  />
                  <TextField
                    label="Description"
                    value={newSegmentDesc}
                    onChange={e => setNewSegmentDesc(e.target.value)}
                    fullWidth
                    margin="normal"
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddSegment} variant="contained">Add</Button>
                </DialogActions>
              </Dialog>
            </Paper>
          )}
          {tab === 3 && (
            <Paper sx={{ maxWidth: 800, p: 3, mb: 2 }} elevation={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>Analytics</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <Box>
                  <BarChart
                    xAxis={[{ data: ['Sent', 'Delivered', 'Failed', 'Clicked'] }]}
                    series={[{ data: [analyticsData.sent, analyticsData.delivered, analyticsData.failed, analyticsData.clicked], label: 'Count' }]}
                    width={350}
                    height={250}
                  />
                </Box>
                <Box>
                  <PieChart
                    series={[{
                      data: [
                        { id: 0, value: analyticsData.sent, label: 'Sent' },
                        { id: 1, value: analyticsData.delivered, label: 'Delivered' },
                        { id: 2, value: analyticsData.failed, label: 'Failed' },
                        { id: 3, value: analyticsData.clicked, label: 'Clicked' },
                      ],
                    }]}
                    width={350}
                    height={250}
                  />
                </Box>
              </Box>
            </Paper>
          )}
          {tab === 4 && (
            <Paper sx={{ maxWidth: 700, p: 3, mb: 2 }} elevation={3}>
              <Typography variant="h6" sx={{ mb: 2 }}>Settings</Typography>
              <Box sx={{ mb: 2 }}>
                <TextField
                  label="VAPID Public Key"
                  value={vapidPublic}
                  fullWidth
                  margin="normal"
                  InputProps={{ endAdornment: <Button onClick={() => handleCopy(vapidPublic)} size="small"><ContentCopyIcon fontSize="small" /></Button> }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="VAPID Private Key"
                  value={vapidPrivate}
                  fullWidth
                  margin="normal"
                  type="password"
                  InputProps={{ endAdornment: <Button onClick={() => handleCopy(vapidPrivate)} size="small"><ContentCopyIcon fontSize="small" /></Button> }}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Firebase Service Account (JSON)"
                  value={firebaseConfig}
                  fullWidth
                  margin="normal"
                  multiline
                  rows={3}
                  InputProps={{ endAdornment: <Button onClick={() => handleCopy(firebaseConfig)} size="small"><ContentCopyIcon fontSize="small" /></Button> }}
                  InputLabelProps={{ shrink: true }}
                />
                {copyMsg && <Alert severity="success" sx={{ mt: 2 }}>{copyMsg}</Alert>}
              </Box>
            </Paper>
          )}
          {tab === 6 && (
            <Box p={2}>
              <Typography variant="h6" gutterBottom>Create Notification Journey</Typography>
              <form onSubmit={handleJourneySubmit}>
                <TextField label="Journey Name" value={journeyName} onChange={e => setJourneyName(e.target.value)} fullWidth sx={{ mb: 2 }} required />
                {journeySteps.map((step, idx) => (
                  <Paper key={idx} sx={{ p: 2, mb: 2, position: 'relative' }} elevation={2}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle1">Step {idx + 1}</Typography>
                      <Button size="small" onClick={() => moveJourneyStep(idx, -1)} disabled={idx === 0}>↑</Button>
                      <Button size="small" onClick={() => moveJourneyStep(idx, 1)} disabled={idx === journeySteps.length - 1}>↓</Button>
                      <Button size="small" color="error" onClick={() => removeJourneyStep(idx)} disabled={journeySteps.length === 1}>Remove</Button>
                    </Box>
                    <TextField label="Title" value={step.title} onChange={e => handleJourneyStepChange(idx, 'title', e.target.value)} fullWidth sx={{ mb: 1 }} required />
                    <TextField label="Body" value={step.body} onChange={e => handleJourneyStepChange(idx, 'body', e.target.value)} fullWidth multiline rows={2} sx={{ mb: 1 }} required />
                    <Box sx={{ mb: 1 }}>
                      <Button variant="outlined" component="label" disabled={step.uploading}>
                        {step.uploading ? 'Uploading...' : 'Upload Image'}
                        <input type="file" accept="image/*" hidden onChange={e => { if (e.target.files?.[0]) handleJourneyStepImage(idx, e.target.files[0]); }} />
                      </Button>
                      {step.uploadError && <Typography color="error" variant="caption">{step.uploadError}</Typography>}
                      {step.image && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption">Preview:</Typography>
                          <img src={step.image} alt="Preview" style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }} />
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                      <Box>
                        <Typography variant="caption">Days of Week:</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {daysOfWeekList.map(day => (
                            <FormControlLabel
                              key={day.key}
                              control={
                                <Checkbox
                                  checked={(step.daysOfWeek as string[]).includes(day.key)}
                                  onChange={() => handleJourneyStepDays(idx, day.key)}
                                />
                              }
                              label={day.label}
                            />
                          ))}
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption">Times of Day:</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {step.timesOfDay.map((time, tIdx) => (
                            <Box key={tIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <input type="time" value={time} onChange={e => handleJourneyStepTime(idx, tIdx, e.target.value)} />
                              {step.timesOfDay.length > 1 && (
                                <Button size="small" onClick={() => removeJourneyStepTime(idx, tIdx)}>-</Button>
                              )}
                            </Box>
                          ))}
                          <Button size="small" onClick={() => addJourneyStepTime(idx)}>+</Button>
                        </Box>
                      </Box>
                    </Box>
                    <TextField
                      select
                      label="Segment"
                      value={step.segment}
                      onChange={e => handleJourneyStepChange(idx, 'segment', e.target.value)}
                      sx={{ width: 150 }}
                    >
                      <MenuItem value="all">All Users</MenuItem>
                      <MenuItem value="members">Members</MenuItem>
                      <MenuItem value="non-members">Non-Members</MenuItem>
                    </TextField>
                  </Paper>
                ))}
                <Button variant="contained" onClick={addJourneyStep} sx={{ mb: 2 }}>Add Step</Button>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview:</Typography>
                <ol>
                  {journeySteps.map((step, idx) => (
                    <li key={idx}>
                      <b>{step.title}</b> ({step.delay} {step.delayUnit}, {step.segment})<br />
                      {step.body}<br />
                      {step.image && <img src={step.image} alt="Preview" style={{ maxWidth: 100, borderRadius: 4, marginTop: 2 }} />}<br />
                      <span style={{ fontSize: 12, color: '#555' }}>
                        Days: {step.daysOfWeek.map(d => daysOfWeekList.find(x => x.key === d)?.label).join(', ') || 'All'}<br />
                        Times: {step.timesOfDay.join(', ')}
                      </span>
                    </li>
                  ))}
                </ol>
                <Button type="submit" variant="contained" color="primary">Submit Journey</Button>
              </form>
            </Box>
          )}
          {tab === 7 && (
            <Box p={2}>
              <Typography variant="h6" gutterBottom>Active Journeys</Typography>
              {activeJourneysLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', height: 200 }}><CircularProgress /></Box>
              ) : activeJourneysError ? (
                <Alert severity="error">{activeJourneysError}</Alert>
              ) : (
                <div style={{ height: 400, width: '100%' }}>
                  <DataGrid
                    rows={activeJourneys.map((j, i) => ({ id: i, ...j }))}
                    columns={[
                      { field: 'journeyName', headerName: 'Journey Name', width: 200 },
                      { field: 'totalSteps', headerName: 'Total Steps', width: 120 },
                      { field: 'pendingSteps', headerName: 'Pending Steps', width: 120 },
                      { field: 'nextScheduled', headerName: 'Next Scheduled', width: 200 },
                      { field: 'status', headerName: 'Status', width: 120 },
                      {
                        field: 'actions',
                        headerName: 'Actions',
                        width: 120,
                        renderCell: (params: any) => (
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={params.row.status !== 'Active'}
                            onClick={() => handleStopJourney(params.row.journeyName)}
                          >
                            Stop
                          </Button>
                        ),
                      },
                    ]}
                    pageSizeOptions={[5, 10, 20]}
                    initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
                    disableRowSelectionOnClick
                    sx={{ background: 'background.paper' }}
                  />
                </div>
              )}
            </Box>
          )}
          {tab === 8 && (
            <Box p={2}>
              <Typography variant="h6" gutterBottom>Inactive User Campaign</Typography>
              <form onSubmit={handleInactiveSubmit}>
                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <TextField
                    label="Inactive for"
                    type="number"
                    value={inactiveDuration}
                    onChange={e => setInactiveDuration(Number(e.target.value))}
                    sx={{ width: 120 }}
                    inputProps={{ min: 1 }}
                    required
                  />
                  <TextField
                    select
                    label="Unit"
                    value={inactiveUnit}
                    onChange={e => setInactiveUnit(e.target.value)}
                    sx={{ width: 120 }}
                  >
                    <MenuItem value="hours">Hours</MenuItem>
                    <MenuItem value="days">Days</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Segment"
                    value={inactiveSegment}
                    onChange={e => setInactiveSegment(e.target.value)}
                    sx={{ width: 150 }}
                  >
                    <MenuItem value="all">All Users</MenuItem>
                    <MenuItem value="members">Members</MenuItem>
                    <MenuItem value="non-members">Non-Members</MenuItem>
                  </TextField>
                </Box>
                <TextField label="Title" value={inactiveTitle} onChange={e => setInactiveTitle(e.target.value)} fullWidth sx={{ mb: 1 }} required />
                <TextField label="Body" value={inactiveBody} onChange={e => setInactiveBody(e.target.value)} fullWidth multiline rows={2} sx={{ mb: 1 }} required />
                <Box sx={{ mb: 1 }}>
                  <Button variant="outlined" component="label" disabled={inactiveUploading}>
                    {inactiveUploading ? 'Uploading...' : 'Upload Image'}
                    <input type="file" accept="image/*" hidden onChange={handleInactiveImageUpload} />
                  </Button>
                  {inactiveUploadError && <Typography color="error" variant="caption">{inactiveUploadError}</Typography>}
                  {inactiveImage && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption">Preview:</Typography>
                      <img src={inactiveImage} alt="Preview" style={{ maxWidth: 200, borderRadius: 8, marginTop: 4 }} />
                    </Box>
                  )}
                </Box>
                <TextField label="URL to Open on Click (Optional)" value={inactiveUrl} onChange={e => setInactiveUrl(e.target.value)} fullWidth sx={{ mb: 1 }} />
                <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption">Days of Week:</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {daysOfWeekList.map(day => (
                        <FormControlLabel
                          key={day.key}
                          control={<Checkbox checked={inactiveDays.includes(day.key)} onChange={() => handleInactiveDay(day.key)} />}
                          label={day.label}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption">Times of Day:</Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {inactiveTimes.map((time, tIdx) => (
                        <Box key={tIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <input type="time" value={time} onChange={e => handleInactiveTime(tIdx, e.target.value)} />
                          {inactiveTimes.length > 1 && (
                            <Button size="small" onClick={() => removeInactiveTime(tIdx)}>-</Button>
                          )}
                        </Box>
                      ))}
                      <Button size="small" onClick={addInactiveTime}>+</Button>
                    </Box>
                  </Box>
                </Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview:</Typography>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <b>{inactiveTitle}</b><br />
                  {inactiveBody}<br />
                  {inactiveImage && <img src={inactiveImage} alt="Preview" style={{ maxWidth: 100, borderRadius: 4, marginTop: 2 }} />}<br />
                  <span style={{ fontSize: 12, color: '#555' }}>
                    Inactive for: {inactiveDuration} {inactiveUnit}<br />
                    Segment: {inactiveSegment}<br />
                    Days: {inactiveDays.map(d => daysOfWeekList.find(x => x.key === d)?.label).join(', ') || 'All'}<br />
                    Times: {inactiveTimes.join(', ')}<br />
                    URL: {inactiveUrl}
                  </span>
                </Paper>
                <Button type="submit" variant="contained" color="primary">Submit Campaign</Button>
              </form>
            </Box>
          )}
          {tab !== 0 && (
            <Typography paragraph>
              Feature coming soon!
            </Typography>
          )}
        </Box>
        <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onKeyDown={handleDialogKeyDown}>
          <DialogTitle>Confirm Action</DialogTitle>
          <DialogContent>
            <DialogContentText>{confirmMsg}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button ref={confirmButtonRef} autoFocus onClick={() => { if (confirmAction) confirmAction(); }} variant="contained" color="primary">Confirm</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={helpOpen} onClose={() => setHelpOpen(false)}>
          <DialogTitle>Dashboard Help & Info</DialogTitle>
          <DialogContent>
            <DialogContentText>
              <b>How to use this dashboard:</b><br /><br />
              <b>Send Notification:</b> Send push notifications to a specific user or broadcast to all users.<br />
              <b>Notification History:</b> View all sent notifications with status and details.<br />
              <b>User Segments:</b> Manage user groups for targeted notifications.<br />
              <b>Analytics:</b> See stats for sent, delivered, failed, and clicked notifications.<br />
              <b>Settings:</b> View/copy VAPID keys and Firebase config.<br />
              <b>Dark/Light Mode:</b> Toggle dashboard theme.<br />
              <b>Keyboard Shortcuts:</b> Enter/Escape in dialogs, Tab navigation everywhere.<br /><br />
              For more help, contact your admin or developer team.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setHelpOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={2000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
        <Box component="footer" sx={{ width: '100%', py: 2, px: 2, mt: 4, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', textAlign: 'center', position: 'fixed', bottom: 0, left: 0, zIndex: theme.zIndex.drawer - 1 }}>
          <Typography variant="body2" color="text.secondary">
            © {new Date().getFullYear()} SBHS. Smart Bharat Health Services (SBHS) is an independent health service platform. <a href="/disclaimer" style={{ color: 'inherit', textDecoration: 'underline' }}>Disclaimer</a>
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
} 