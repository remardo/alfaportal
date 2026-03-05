import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Users, Shield, Calendar, Target,
  Settings, HelpCircle, Bell, ChevronRight,
  MoreHorizontal, Edit2, Trash2, FileText, CheckCircle2, AlertTriangle, XCircle, X,
  TrendingUp, DollarSign, Activity, Clock, MapPin, ArrowUpRight, ArrowDownRight,
  Building, Map, BookOpen, Plus, FileSignature,
  ChevronLeft, Filter, GripVertical, CalendarDays,
  Printer, History, Lock, RotateCcw,
  Database, MessageSquare, Phone, Key, Sliders, Zap
} from 'lucide-react';
import type { Employee, LicenseStatus, ScheduleEntry, SecurityObject, ShiftType } from './src/domain/entities';
import { InMemoryEmployeeRepository } from './src/adapters/repositories/in-memory-employee-repository';
import { SearchEmployeesUseCase } from './src/use-cases/search-employees';
import {
  mockEmployees,
  mockIntegrations,
  mockJournal,
  mockObjects,
  mockSchedule,
  recentAlerts,
  weekDays,
} from './src/infrastructure/mock-data';

type DragCell = { rowId: number; dayIndex: number };
type ObjectDraft = SecurityObject;
type PostInstruction = { post: string; instruction: string };
const defaultObjectTypes = ['Бизнес-центр', 'Торговый центр', 'Жилой комплекс', 'Промзона'];
const EXPIRING_DAYS_THRESHOLD = 30;
const khoAmmoReserveBase = 1250;
type ScheduleTemplate = '2/2 день' | '2/2 ночь' | 'сутки/двое' | '5/2 день';

type KhoWeapon = {
  id: string;
  label: string;
  inKho: boolean;
  issuedToEmployeeId: number | null;
  issuedAmmo: number;
  lastIssuedAt: string | null;
};

type KhoJournalEntry = (typeof mockJournal)[number] & {
  createdAt: string;
  employeeId?: number;
  weaponId?: string;
};

const initialKhoWeapons: KhoWeapon[] = [
  { id: 'izh-71-0451', label: 'ИЖ-71 (№ 0451)', inKho: true, issuedToEmployeeId: null, issuedAmmo: 0, lastIssuedAt: null },
  { id: 'saiga-1102', label: 'Сайга-410К (№ 1102)', inKho: true, issuedToEmployeeId: null, issuedAmmo: 0, lastIssuedAt: null },
  { id: 'mr-471-0099', label: 'МР-471 (№ 0099)', inKho: true, issuedToEmployeeId: null, issuedAmmo: 0, lastIssuedAt: null },
  { id: 'pr-73-12', label: 'ПР-73 (№ 12)', inKho: true, issuedToEmployeeId: null, issuedAmmo: 0, lastIssuedAt: null },
  { id: 'pr-73-15', label: 'ПР-73 (№ 15)', inKho: true, issuedToEmployeeId: null, issuedAmmo: 0, lastIssuedAt: null },
];

const buildTemplateShifts = (template: ScheduleTemplate): ShiftType[] => {
  switch (template) {
    case '2/2 день':
      return ['day', 'day', 'off', 'off', 'day', 'day', 'off'];
    case '2/2 ночь':
      return ['night', 'night', 'off', 'off', 'night', 'night', 'off'];
    case 'сутки/двое':
      return ['24h', 'off', 'off', '24h', 'off', 'off', '24h'];
    case '5/2 день':
    default:
      return ['day', 'day', 'day', 'day', 'day', 'off', 'off'];
  }
};

const toScheduleShortName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fullName;
  if (parts.length === 1) return parts[0];
  const initials = parts.slice(1).map((part) => `${part[0]}.`).join('');
  return `${parts[0]} ${initials}`;
};

const shiftHoursMap: Record<ShiftType, number> = {
  day: 12,
  night: 12,
  '24h': 24,
  off: 0,
};

const calculateHours = (shifts: ShiftType[]) => {
  return shifts.reduce((sum, shift) => sum + shiftHoursMap[shift], 0);
};

export default function AlphaPortal() {
  const [activeTab, setActiveTab] = useState('кадры');
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [objects, setObjects] = useState<SecurityObject[]>(mockObjects);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(mockSchedule);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Employee | null>(null);
  const [activeObjectMenuId, setActiveObjectMenuId] = useState<number | null>(null);
  const [isObjectEditOpen, setIsObjectEditOpen] = useState(false);
  const [objectDraft, setObjectDraft] = useState<ObjectDraft | null>(null);
  const [objectEditorMode, setObjectEditorMode] = useState<'create' | 'edit'>('edit');
  const [passportObject, setPassportObject] = useState<SecurityObject | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [activeInstructionsObjectId, setActiveInstructionsObjectId] = useState<number | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState<PostInstruction[]>([]);
  const [objectInstructions, setObjectInstructions] = useState<Record<number, PostInstruction[]>>(() => {
    return mockObjects.reduce<Record<number, PostInstruction[]>>((acc, objectItem) => {
      acc[objectItem.id] = objectItem.posts.map((postName) => ({
        post: postName,
        instruction: `Инструкция для поста "${postName}"`,
      }));
      return acc;
    }, {});
  });
  const [draggedCell, setDraggedCell] = useState<DragCell | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [khoWeapons, setKhoWeapons] = useState<KhoWeapon[]>(initialKhoWeapons);
  const [khoJournal, setKhoJournal] = useState<KhoJournalEntry[]>(
    mockJournal.map((entry, index) => ({
      ...entry,
      createdAt: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    }))
  );
  const [khoForm, setKhoForm] = useState({ employeeId: '', weaponId: '', ammo: '16' });
  const [khoFilterQuery, setKhoFilterQuery] = useState('');
  const [showKhoArchive, setShowKhoArchive] = useState(false);
  const [manualShiftDayIndex, setManualShiftDayIndex] = useState(0);
  const [manualShiftType, setManualShiftType] = useState<ShiftType>('day');
  const [isEmployeeCreateOpen, setIsEmployeeCreateOpen] = useState(false);
  const [newEmployeeDraft, setNewEmployeeDraft] = useState({
    name: '',
    phone: '',
    weaponId: '',
    licenseDate: '',
    medCheck: '',
    periodicCheckDate: '',
    addToSchedule: true,
    scheduleTemplate: '2/2 день' as ScheduleTemplate,
  });
  const [postAssignments, setPostAssignments] = useState<Record<number, Record<string, number | null>>>(() => {
    const initial: Record<number, Record<string, number | null>> = {};
    mockObjects.forEach((objectItem) => {
      initial[objectItem.id] = {};
      objectItem.posts.forEach((postName) => {
        const matchedEmployee = mockEmployees.find(
          (employee) => employee.post.includes(objectItem.name) && employee.post.includes(postName)
        );
        initial[objectItem.id][postName] = matchedEmployee?.id ?? null;
      });
    });
    return initial;
  });

  const filteredEmployees = useMemo(() => {
    const employeeRepository = new InMemoryEmployeeRepository(employees);
    const searchEmployeesUseCase = new SearchEmployeesUseCase(employeeRepository);
    return searchEmployeesUseCase.execute(searchQuery);
  }, [employees, searchQuery]);

  const filteredObjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return objects;
    }
    return objects.filter((obj) => {
      return (
        obj.name.toLowerCase().includes(normalizedQuery) ||
        obj.address.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [objects, searchQuery]);

  const objectTypeOptions = useMemo(() => {
    const knownTypes = new Set(defaultObjectTypes);
    objects.forEach((obj) => {
      if (obj.type.trim()) {
        knownTypes.add(obj.type.trim());
      }
    });
    return Array.from(knownTypes);
  }, [objects]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const showToast = (message: string) => {
    setToastMessage(message);
  };

  useEffect(() => {
    setPostAssignments((prev) => {
      const next: Record<number, Record<string, number | null>> = {};
      objects.forEach((objectItem) => {
        const prevObjectAssignments = prev[objectItem.id] ?? {};
        next[objectItem.id] = {};
        objectItem.posts.forEach((postName) => {
          const assignedEmployeeId = prevObjectAssignments[postName] ?? null;
          const hasEmployee = assignedEmployeeId ? employees.some((employee) => employee.id === assignedEmployeeId) : true;
          next[objectItem.id][postName] = hasEmployee ? assignedEmployeeId : null;
        });
      });
      return next;
    });
  }, [objects, employees]);

  const objectPostOptions = useMemo(() => {
    return objects.flatMap((objectItem) =>
      objectItem.posts.map((postName) => ({
        objectId: objectItem.id,
        objectName: objectItem.name,
        postName,
      }))
    );
  }, [objects]);

  const availableKhoWeaponsForHiring = useMemo(
    () => khoWeapons.filter((weapon) => weapon.inKho),
    [khoWeapons]
  );

  const schedulePostOptions = useMemo(() => {
    return objectPostOptions.map((option) => ({
      value: `${option.objectId}::${option.postName}`,
      label: `${option.objectName} (${option.postName})`,
      objectId: option.objectId,
      postName: option.postName,
    }));
  }, [objectPostOptions]);

  const assignScheduleEmployeeToPost = (scheduleRow: ScheduleEntry, assignmentValue: string) => {
    const selectedOption = schedulePostOptions.find((option) => option.value === assignmentValue);
    if (!selectedOption) {
      showToast('Выбранный пост не найден');
      return;
    }
    const nextPostLabel = selectedOption.label;
    const matchedEmployee = employees.find(
      (employee) => employee.name === scheduleRow.name || toScheduleShortName(employee.name) === scheduleRow.name
    );
    setSchedule((prev) =>
      prev.map((row) => (row.id === scheduleRow.id ? { ...row, employeeId: matchedEmployee?.id ?? row.employeeId, post: nextPostLabel } : row))
    );
    if (!matchedEmployee) {
      showToast(`Назначение обновлено в графике: ${nextPostLabel}`);
      return;
    }

    setEmployees((prev) =>
      prev.map((employee) =>
        employee.id === matchedEmployee.id ? { ...employee, post: nextPostLabel } : employee
      )
    );

    setPostAssignments((prev) => {
      const next: Record<number, Record<string, number | null>> = {};
      Object.entries(prev).forEach(([objectId, postsMap]) => {
        next[Number(objectId)] = {};
        Object.entries(postsMap).forEach(([postName, employeeId]) => {
          next[Number(objectId)][postName] = employeeId === matchedEmployee.id ? null : employeeId;
        });
      });
      if (!next[selectedOption.objectId]) {
        next[selectedOption.objectId] = {};
      }
      next[selectedOption.objectId][selectedOption.postName] = matchedEmployee.id;
      return next;
    });

    showToast(`Сотрудник назначен: ${matchedEmployee.name} -> ${nextPostLabel}`);
  };

  const findScheduleRowForEmployee = (employee: Employee) => {
    return schedule.find(
      (row) =>
        row.employeeId === employee.id ||
        row.name === employee.name ||
        row.name === toScheduleShortName(employee.name)
    );
  };

  const updateEmployeeSchedule = (
    employee: Employee,
    updater: (current: ScheduleEntry) => ScheduleEntry
  ) => {
    setSchedule((prev) => {
      const index = prev.findIndex(
        (row) =>
          row.employeeId === employee.id ||
          row.name === employee.name ||
          row.name === toScheduleShortName(employee.name)
      );
      if (index < 0) {
        const nextId = prev.length ? Math.max(...prev.map((row) => row.id)) + 1 : 1;
        const base: ScheduleEntry = {
          id: nextId,
          employeeId: employee.id,
          name: toScheduleShortName(employee.name),
          post: employee.post,
          shifts: weekDays.map(() => 'off' as ShiftType),
          hours: 0,
        };
        return [...prev, updater(base)];
      }
      const next = [...prev];
      next[index] = updater({ ...next[index], shifts: [...next[index].shifts], employeeId: employee.id });
      return next;
    });
  };

  const getDateDiffInDays = (date: string) => {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDocumentStatus = (date: string): LicenseStatus => {
    const daysLeft = getDateDiffInDays(date);
    if (daysLeft < 0) {
      return 'expired';
    }
    if (daysLeft <= EXPIRING_DAYS_THRESHOLD) {
      return 'expiring';
    }
    return 'valid';
  };

  const getStatusBadge = (date: string) => {
    const status = getDocumentStatus(date);
    switch(status) {
      case 'valid':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> До {date}</span>;
      case 'expiring':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" /> До {date}</span>;
      case 'expired':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200"><XCircle className="w-3 h-3 mr-1" /> Просрочено ({date})</span>;
      default:
        return null;
    }
  };

  const complianceSummary = useMemo(() => {
    const summary = {
      ulchoExpired: 0,
      ulchoExpiring: 0,
      medExpired: 0,
      medExpiring: 0,
      periodicExpired: 0,
      periodicExpiring: 0,
    };

    employees.forEach((employee) => {
      const ulcho = getDocumentStatus(employee.licenseDate);
      const med = getDocumentStatus(employee.medCheck);
      const periodic = getDocumentStatus(employee.periodicCheckDate);

      if (ulcho === 'expired') summary.ulchoExpired += 1;
      if (ulcho === 'expiring') summary.ulchoExpiring += 1;
      if (med === 'expired') summary.medExpired += 1;
      if (med === 'expiring') summary.medExpiring += 1;
      if (periodic === 'expired') summary.periodicExpired += 1;
      if (periodic === 'expiring') summary.periodicExpiring += 1;
    });

    return summary;
  }, [employees]);

  const complianceAlerts = useMemo(() => {
    const alerts: Array<{
      id: string;
      level: 'expired' | 'expiring';
      employeeId: number;
      employeeName: string;
      documentLabel: string;
      date: string;
      daysLeft: number;
    }> = [];

    employees.forEach((employee) => {
      const docs = [
        { label: 'УЛЧО', date: employee.licenseDate },
        { label: 'Справка 002/003', date: employee.medCheck },
        { label: 'Периодическая проверка', date: employee.periodicCheckDate },
      ];

      docs.forEach((doc) => {
        const daysLeft = getDateDiffInDays(doc.date);
        const status = getDocumentStatus(doc.date);
        if (status === 'valid') {
          return;
        }
        alerts.push({
          id: `${employee.id}-${doc.label}`,
          level: status,
          employeeId: employee.id,
          employeeName: employee.name,
          documentLabel: doc.label,
          date: doc.date,
          daysLeft,
        });
      });
    });

    return alerts.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [employees]);

  const activePostsCount = useMemo(
    () => objects.reduce((sum, objectItem) => sum + objectItem.postsCount, 0),
    [objects]
  );
  const staffedPosts = schedule.length;
  const emptyPosts = Math.max(activePostsCount - staffedPosts, 0);
  const highRiskDocuments = complianceAlerts.filter((alertItem) => alertItem.level === 'expired').length;
  const mediumRiskDocuments = complianceAlerts.filter((alertItem) => alertItem.level === 'expiring').length;
  const issuedWeaponsCount = khoWeapons.filter((weapon) => !weapon.inKho).length;

  const dashboardTasks = useMemo(() => {
    const tasks: Array<{ id: string; title: string; desc: string; severity: 'high' | 'medium' | 'low' }> = [];
    if (highRiskDocuments > 0) {
      tasks.push({
        id: 'docs-expired',
        title: 'Просроченные документы',
        desc: `${highRiskDocuments} документов требуют немедленного отстранения/замены.`,
        severity: 'high',
      });
    }
    if (emptyPosts > 0) {
      tasks.push({
        id: 'empty-posts',
        title: 'Незаполненные посты',
        desc: `${emptyPosts} постов в текущем контуре без закрепленного сотрудника.`,
        severity: 'high',
      });
    }
    if (issuedWeaponsCount > 0) {
      tasks.push({
        id: 'weapons-control',
        title: 'Контроль оружия на руках',
        desc: `${issuedWeaponsCount} ед. вооружения выданы, требуется контроль возврата по сменам.`,
        severity: 'medium',
      });
    }
    if (mediumRiskDocuments > 0) {
      tasks.push({
        id: 'docs-expiring',
        title: 'Скорые истечения документов',
        desc: `${mediumRiskDocuments} документов истекают в ближайшие 30 дней.`,
        severity: 'medium',
      });
    }
    if (!tasks.length) {
      tasks.push({
        id: 'stable',
        title: 'Операционная стабильность',
        desc: 'Критичных задач не найдено. Выполняйте плановые проверки.',
        severity: 'low',
      });
    }
    return tasks;
  }, [emptyPosts, highRiskDocuments, issuedWeaponsCount, mediumRiskDocuments]);

  const selectedEmployeeSchedule = useMemo(() => {
    if (!selectedEmployee) {
      return null;
    }
    return findScheduleRowForEmployee(selectedEmployee) ?? null;
  }, [selectedEmployee, schedule]);

  const selectedEmployeeWeeklyShiftCount = selectedEmployeeSchedule
    ? selectedEmployeeSchedule.shifts.filter((shift) => shift !== 'off').length
    : 0;
  const selectedEmployeeMonthlyShiftCount = Math.round(selectedEmployeeWeeklyShiftCount * 4.33);

  const selectedKhoEmployee = useMemo(() => {
    const employeeId = Number(khoForm.employeeId);
    return employees.find((employee) => employee.id === employeeId) ?? null;
  }, [employees, khoForm.employeeId]);

  const selectedKhoWeapon = useMemo(() => {
    return khoWeapons.find((weapon) => weapon.id === khoForm.weaponId) ?? null;
  }, [khoForm.weaponId, khoWeapons]);

  const selectedKhoEmployeeHasAccess = useMemo(() => {
    if (!selectedKhoEmployee) {
      return false;
    }
    return (
      getDocumentStatus(selectedKhoEmployee.licenseDate) === 'valid' &&
      getDocumentStatus(selectedKhoEmployee.medCheck) === 'valid' &&
      getDocumentStatus(selectedKhoEmployee.periodicCheckDate) === 'valid'
    );
  }, [selectedKhoEmployee]);

  const khoInHands = useMemo(() => khoWeapons.filter((weapon) => !weapon.inKho), [khoWeapons]);
  const khoAmmoOnHands = useMemo(() => khoInHands.reduce((sum, weapon) => sum + weapon.issuedAmmo, 0), [khoInHands]);
  const khoAmmoReserve = khoAmmoReserveBase - khoAmmoOnHands;

  const isSameDay = (isoA: string, isoB: string) => {
    const a = new Date(isoA);
    const b = new Date(isoB);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  const khoVisibleJournal = useMemo(() => {
    const todayIso = new Date().toISOString();
    return khoJournal
      .filter((entry) => (showKhoArchive ? true : isSameDay(entry.createdAt, todayIso)))
      .filter((entry) => {
        const q = khoFilterQuery.trim().toLowerCase();
        if (!q) {
          return true;
        }
        return (
          entry.employee.toLowerCase().includes(q) ||
          entry.weapon.toLowerCase().includes(q)
        );
      });
  }, [khoJournal, khoFilterQuery, showKhoArchive]);

  const handleKhoIssue = () => {
    if (!selectedKhoEmployee || !selectedKhoWeapon) {
      showToast('Выберите сотрудника и оружие');
      return;
    }
    if (!selectedKhoEmployeeHasAccess) {
      showToast('Выдача заблокирована: просрочены документы сотрудника');
      return;
    }
    if (!selectedKhoWeapon.inKho) {
      showToast('Оружие уже выдано');
      return;
    }
    const ammo = Math.max(0, Number(khoForm.ammo) || 0);
    const issueTime = new Date();
    const timeOut = issueTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    setKhoWeapons((prev) =>
      prev.map((weapon) =>
        weapon.id === selectedKhoWeapon.id
          ? {
              ...weapon,
              inKho: false,
              issuedToEmployeeId: selectedKhoEmployee.id,
              issuedAmmo: ammo,
              lastIssuedAt: issueTime.toISOString(),
            }
          : weapon
      )
    );

    setKhoJournal((prev) => [
      {
        id: prev.length ? Math.max(...prev.map((entry) => entry.id)) + 1 : 1,
        createdAt: issueTime.toISOString(),
        timeOut,
        timeIn: '-',
        employee: selectedKhoEmployee.name,
        weapon: selectedKhoWeapon.label,
        ammo: ammo > 0 ? `${ammo} шт.` : '-',
        status: 'issued',
        employeeId: selectedKhoEmployee.id,
        weaponId: selectedKhoWeapon.id,
      },
      ...prev,
    ]);
    showToast(`Выдано: ${selectedKhoWeapon.label} -> ${selectedKhoEmployee.name}`);
  };

  const handleKhoReturn = () => {
    if (!selectedKhoEmployee || !selectedKhoWeapon) {
      showToast('Выберите сотрудника и оружие для приема');
      return;
    }
    if (selectedKhoWeapon.inKho) {
      showToast('Оружие уже находится в КХО');
      return;
    }
    if (selectedKhoWeapon.issuedToEmployeeId !== selectedKhoEmployee.id) {
      showToast('Это оружие числится за другим сотрудником');
      return;
    }

    const returnTime = new Date();
    const timeIn = returnTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const originalIssue = khoJournal.find(
      (entry) =>
        entry.status === 'issued' &&
        entry.weaponId === selectedKhoWeapon.id &&
        entry.employeeId === selectedKhoEmployee.id
    );

    setKhoWeapons((prev) =>
      prev.map((weapon) =>
        weapon.id === selectedKhoWeapon.id
          ? {
              ...weapon,
              inKho: true,
              issuedToEmployeeId: null,
              issuedAmmo: 0,
            }
          : weapon
      )
    );

    setKhoJournal((prev) => [
      {
        id: prev.length ? Math.max(...prev.map((entry) => entry.id)) + 1 : 1,
        createdAt: returnTime.toISOString(),
        timeOut: originalIssue?.timeOut ?? '-',
        timeIn,
        employee: selectedKhoEmployee.name,
        weapon: selectedKhoWeapon.label,
        ammo: '-',
        status: 'returned',
        employeeId: selectedKhoEmployee.id,
        weaponId: selectedKhoWeapon.id,
      },
      ...prev,
    ]);
    showToast(`Принято на склад: ${selectedKhoWeapon.label}`);
  };

  // Основной цвет из дизайна (коралловый/оранжевый)
  const primaryColor = 'text-[#FF7657]';
  const primaryBg = 'bg-[#FF7657]';
  const primaryBgLight = 'bg-[#FFF0ED]';

  // Функция для рендера бейджа смены (для модуля Графики)
  const renderShiftBadge = (
    shiftType: ShiftType,
    dragOptions?: { draggable: boolean; onDragStart: () => void; onDragEnd: () => void }
  ) => {
    const sharedProps = dragOptions?.draggable
      ? {
          draggable: true,
          onDragStart: dragOptions.onDragStart,
          onDragEnd: dragOptions.onDragEnd,
        }
      : {};

    switch(shiftType) {
      case 'day':
        return <div {...sharedProps} className="flex items-center justify-center w-full h-10 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-xs font-bold shadow-sm cursor-grab hover:bg-blue-100 transition-colors group"><GripVertical className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />08:00 - 20:00</div>;
      case 'night':
        return <div {...sharedProps} className="flex items-center justify-center w-full h-10 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg text-xs font-bold shadow-sm cursor-grab hover:bg-indigo-100 transition-colors group"><GripVertical className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />20:00 - 08:00</div>;
      case '24h':
        return <div {...sharedProps} className="flex items-center justify-center w-full h-10 bg-[#FFF0ED] text-[#FF7657] border border-[#FF7657]/20 rounded-lg text-xs font-bold shadow-sm cursor-grab hover:bg-[#FF7657]/20 transition-colors group"><GripVertical className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />Сутки (24ч)</div>;
      case 'off':
        return <div className="flex items-center justify-center w-full h-10 bg-slate-50 text-slate-400 border border-dashed border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-100 hover:text-slate-600 transition-colors">Выходной</div>;
      default:
        return <div className="w-full h-10 bg-slate-50 rounded-lg"></div>;
    }
  };

  const openEditProfileModal = () => {
    if (!selectedEmployee) {
      return;
    }
    setProfileDraft({ ...selectedEmployee });
    setIsProfileEditOpen(true);
  };

  const openCreateEmployeeModal = () => {
    const today = new Date();
    const plusMonths = (months: number) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().slice(0, 10);
    };
    setNewEmployeeDraft({
      name: '',
      phone: '',
      weaponId: '',
      licenseDate: plusMonths(12),
      medCheck: plusMonths(6),
      periodicCheckDate: plusMonths(6),
      addToSchedule: true,
      scheduleTemplate: '2/2 день',
    });
    setIsEmployeeCreateOpen(true);
  };

  const createEmployee = () => {
    const normalizedName = newEmployeeDraft.name.trim();
    const normalizedPhone = newEmployeeDraft.phone.trim();
    if (!normalizedName || !normalizedPhone) {
      showToast('Укажите ФИО и телефон сотрудника');
      return;
    }
    if (!newEmployeeDraft.licenseDate || !newEmployeeDraft.medCheck || !newEmployeeDraft.periodicCheckDate) {
      showToast('Заполните даты УЛЧО, 002/003 и периодической проверки');
      return;
    }

    const nextEmployeeId = employees.length ? Math.max(...employees.map((employee) => employee.id)) + 1 : 1;
    const selectedWeapon = khoWeapons.find((weapon) => weapon.id === newEmployeeDraft.weaponId);
    const createdEmployee: Employee = {
      id: nextEmployeeId,
      name: normalizedName,
      post: 'Резерв',
      phone: normalizedPhone,
      weapon: selectedWeapon ? selectedWeapon.label : 'Без оружия',
      licenseDate: newEmployeeDraft.licenseDate,
      medCheck: newEmployeeDraft.medCheck,
      periodicCheckDate: newEmployeeDraft.periodicCheckDate,
      status: getDocumentStatus(newEmployeeDraft.licenseDate),
    };

    setEmployees((prev) => [createdEmployee, ...prev]);

    if (newEmployeeDraft.addToSchedule) {
      const shifts = buildTemplateShifts(newEmployeeDraft.scheduleTemplate);
      const nextScheduleId = schedule.length ? Math.max(...schedule.map((row) => row.id)) + 1 : 1;
      const scheduleEntry: ScheduleEntry = {
        id: nextScheduleId,
        employeeId: createdEmployee.id,
        name: toScheduleShortName(createdEmployee.name),
        post: createdEmployee.post,
        shifts,
        hours: calculateHours(shifts),
      };
      setSchedule((prev) => [...prev, scheduleEntry]);
    }

    setSelectedEmployee(createdEmployee);
    setIsEmployeeCreateOpen(false);
    showToast(`Сотрудник добавлен: ${createdEmployee.name}`);
  };

  const saveProfile = () => {
    if (!profileDraft) {
      return;
    }
    setEmployees((prev) => prev.map((employee) => (employee.id === profileDraft.id ? profileDraft : employee)));
    setSchedule((prev) =>
      prev.map((row) =>
        row.employeeId === profileDraft.id ||
        row.name === profileDraft.name ||
        row.name === toScheduleShortName(profileDraft.name)
          ? { ...row, employeeId: profileDraft.id, name: toScheduleShortName(profileDraft.name), post: profileDraft.post }
          : row
      )
    );
    setSelectedEmployee(profileDraft);
    setIsProfileEditOpen(false);
    showToast('Профиль сотрудника сохранен');
  };

  const setProfileShift = (employee: Employee, dayIndex: number, shiftType: ShiftType) => {
    updateEmployeeSchedule(employee, (current) => {
      const shifts = [...current.shifts];
      shifts[dayIndex] = shiftType;
      return {
        ...current,
        employeeId: employee.id,
        name: toScheduleShortName(employee.name),
        post: employee.post,
        shifts,
        hours: calculateHours(shifts),
      };
    });
  };

  const addManualShiftForEmployee = (employee: Employee) => {
    setProfileShift(employee, manualShiftDayIndex, manualShiftType);
    showToast(`Смена добавлена: ${weekDays[manualShiftDayIndex].day} (${manualShiftType})`);
  };

  const openObjectPassport = (objectItem: SecurityObject) => {
    setPassportObject(objectItem);
  };

  const addObject = () => {
    const nextId = objects.reduce((maxId, obj) => Math.max(maxId, obj.id), 0) + 1;
    const newObject: SecurityObject = {
      id: nextId,
      name: '',
      type: 'Бизнес-центр',
      address: '',
      postsCount: 1,
      posts: ['Пост 1'],
      status: 'active',
      passport: 'missing',
    };
    setObjectEditorMode('create');
    setObjectDraft(newObject);
    setIsObjectEditOpen(true);
  };

  const openObjectEditModal = (objectId: number) => {
    const targetObject = objects.find((obj) => obj.id === objectId);
    if (!targetObject) {
      return;
    }
    setObjectEditorMode('edit');
    setObjectDraft({ ...targetObject, posts: [...targetObject.posts] });
    setIsObjectEditOpen(true);
    setActiveObjectMenuId(null);
  };

  const saveObject = () => {
    if (!objectDraft) {
      return;
    }
    const normalizedName = objectDraft.name.trim();
    const normalizedAddress = objectDraft.address.trim();
    const normalizedType = objectDraft.type.trim();
    if (!normalizedName || !normalizedAddress || !normalizedType) {
      showToast('Заполните название, адрес и тип объекта');
      return;
    }
    const normalizedPosts = objectDraft.posts.map((post) => post.trim()).filter(Boolean);
    const preparedObject: SecurityObject = {
      ...objectDraft,
      name: normalizedName,
      address: normalizedAddress,
      type: normalizedType,
      posts: normalizedPosts.length ? normalizedPosts : ['Пост 1'],
      postsCount: normalizedPosts.length ? normalizedPosts.length : 1,
    };

    if (objectEditorMode === 'create') {
      setObjects((prev) => [preparedObject, ...prev]);
      setObjectInstructions((prev) => ({
        ...prev,
        [preparedObject.id]: preparedObject.posts.map((postName) => ({
          post: postName,
          instruction: `Инструкция для поста "${postName}"`,
        })),
      }));
      setIsObjectEditOpen(false);
      showToast(`Объект создан: ${preparedObject.name}`);
      return;
    }

    setObjects((prev) => prev.map((obj) => (obj.id === preparedObject.id ? preparedObject : obj)));
    setObjectInstructions((prev) => {
      const current = prev[preparedObject.id] ?? [];
      const merged = preparedObject.posts.map((postName) => {
        const existed = current.find((item) => item.post === postName);
        return existed ?? { post: postName, instruction: `Инструкция для поста "${postName}"` };
      });
      return { ...prev, [preparedObject.id]: merged };
    });
    setIsObjectEditOpen(false);
    showToast(`Объект сохранен: ${preparedObject.name}`);
  };

  const deleteObject = (objectId: number) => {
    const targetObject = objects.find((obj) => obj.id === objectId);
    if (!targetObject) {
      return;
    }
    const isConfirmed = window.confirm(`Удалить объект "${targetObject.name}"?`);
    if (!isConfirmed) {
      return;
    }
    setObjects((prev) => prev.filter((obj) => obj.id !== objectId));
    setObjectInstructions((prev) => {
      const next = { ...prev };
      delete next[objectId];
      return next;
    });
    setActiveObjectMenuId(null);
    showToast(`Объект удален: ${targetObject.name}`);
  };

  const openInstructionsModal = (objectId: number) => {
    const targetObject = objects.find((obj) => obj.id === objectId);
    if (!targetObject) {
      return;
    }
    const preparedInstructions = (objectInstructions[objectId] ?? targetObject.posts.map((postName) => ({
      post: postName,
      instruction: '',
    }))).map((item) => ({ ...item }));
    setActiveInstructionsObjectId(objectId);
    setInstructionsDraft(preparedInstructions);
    setIsInstructionsOpen(true);
  };

  const saveInstructions = () => {
    if (!activeInstructionsObjectId) {
      return;
    }
    const normalizedInstructions = instructionsDraft
      .map((item) => ({ post: item.post.trim(), instruction: item.instruction.trim() }))
      .filter((item) => item.post);
    if (!normalizedInstructions.length) {
      return;
    }

    setObjectInstructions((prev) => ({
      ...prev,
      [activeInstructionsObjectId]: normalizedInstructions,
    }));
    setObjects((prev) =>
      prev.map((obj) =>
        obj.id === activeInstructionsObjectId
          ? { ...obj, posts: normalizedInstructions.map((item) => item.post), postsCount: normalizedInstructions.length }
          : obj
      )
    );
    setIsInstructionsOpen(false);
    showToast('Инструкции по постам сохранены');
  };

  const showObjectMap = (objectName: string, address: string) => {
    const targetUrl = `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`;
    const openedWindow = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (openedWindow) {
      showToast(`Схема открыта: ${objectName}`);
      return;
    }
    showToast('Браузер заблокировал открытие карты');
  };

  const onShiftDragStart = (rowId: number, dayIndex: number) => {
    setDraggedCell({ rowId, dayIndex });
  };

  const onShiftDrop = (targetRowId: number, targetDayIndex: number) => {
    if (!draggedCell) {
      return;
    }
    if (draggedCell.rowId === targetRowId && draggedCell.dayIndex === targetDayIndex) {
      setDraggedCell(null);
      return;
    }

    setSchedule((prev) => {
      const sourceRowIndex = prev.findIndex((row) => row.id === draggedCell.rowId);
      const targetRowIndex = prev.findIndex((row) => row.id === targetRowId);
      if (sourceRowIndex < 0 || targetRowIndex < 0) {
        return prev;
      }

      const nextSchedule = prev.map((row) => ({ ...row, shifts: [...row.shifts] }));
      const sourceShift = nextSchedule[sourceRowIndex].shifts[draggedCell.dayIndex];
      const targetShift = nextSchedule[targetRowIndex].shifts[targetDayIndex];

      nextSchedule[sourceRowIndex].shifts[draggedCell.dayIndex] = targetShift;
      nextSchedule[targetRowIndex].shifts[targetDayIndex] = sourceShift;

      nextSchedule[sourceRowIndex].hours = calculateHours(nextSchedule[sourceRowIndex].shifts);
      nextSchedule[targetRowIndex].hours = calculateHours(nextSchedule[targetRowIndex].shifts);

      return nextSchedule;
    });

    setDraggedCell(null);
    showToast('Смена перетащена и обновлена');
  };

  const autoArrangeSchedule = () => {
    const pattern: ShiftType[] = ['day', 'night', 'off', 'off', '24h', 'off', 'day'];
    setSchedule((prev) =>
      prev.map((row, rowIndex) => {
        const shifts = weekDays.map((_, dayIndex) => pattern[(dayIndex + rowIndex) % pattern.length]);
        return { ...row, shifts, hours: calculateHours(shifts) };
      })
    );
    showToast('Авто-расстановка выполнена');
  };

  const publishSchedule = () => {
    const timestamp = new Date().toLocaleString('ru-RU');
    setPublishedAt(timestamp);
    showToast('Табель опубликован');
  };

  return (
    <div className="flex h-screen bg-[#F5F6F9] font-sans text-slate-800 overflow-hidden">
      
      {/* ЛЕВОЕ МЕНЮ (Сайдбар) */}
      <aside className="w-64 flex flex-col justify-between py-6 px-4">
        <div>
          {/* Логотип */}
          <div className="flex items-center px-4 mb-10">
            <span className={`text-4xl font-black tracking-tighter ${primaryColor}`}>
              альфа
            </span>
            <span className="ml-2 text-xs font-semibold text-slate-400 uppercase tracking-widest mt-2">портал</span>
          </div>

          {/* Навигация */}
          <nav className="space-y-1.5">
            {[
              { id: 'дашборд', icon: FileText, label: 'Дашборд' },
              { id: 'кадры', icon: Users, label: 'Кадры и Лицензии' },
              { id: 'объекты', icon: Shield, label: 'Объекты и Посты' },
              { id: 'графики', icon: Calendar, label: 'Графики и Смены' },
              { id: 'кхо', icon: Target, label: 'КХО (Оружейка)' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSelectedEmployee(null); }}
                className={`w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-200 ${
                  activeTab === item.id 
                    ? `${primaryBgLight} ${primaryColor} font-semibold shadow-sm` 
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-medium'
                }`}
              >
                <item.icon className={`w-5 h-5 mr-3 ${activeTab === item.id ? primaryColor : 'text-slate-400'}`} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Нижняя часть меню */}
        <div className="space-y-1.5">
          <button 
            onClick={() => { setActiveTab('настройки'); setSelectedEmployee(null); }}
            className={`w-full flex items-center px-4 py-3 rounded-2xl transition-all duration-200 ${
              activeTab === 'настройки' 
                ? `${primaryBgLight} ${primaryColor} font-semibold shadow-sm` 
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800 font-medium'
            }`}
          >
            <Settings className={`w-5 h-5 mr-3 ${activeTab === 'настройки' ? primaryColor : 'text-slate-400'}`} /> Настройки
          </button>
          <button className="w-full flex items-center px-4 py-3 rounded-2xl text-slate-500 hover:bg-slate-200 transition-all font-medium">
            <HelpCircle className="w-5 h-5 mr-3 text-slate-400" /> Поддержка
          </button>
          
          {/* Профиль пользователя */}
          <div className="mt-6 p-4 rounded-2xl bg-white shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow border border-slate-100">
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold mr-3 border-2 border-white shadow-sm">
                АН
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">Нач. Охраны</p>
                <p className="text-xs text-slate-400">ID: 001</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </div>
      </aside>

      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 flex flex-col p-6 pl-0 overflow-hidden relative">
        {/* Белая подложка с большим скруглением как в дизайне */}
        <div className="bg-white rounded-[2.5rem] shadow-sm flex-1 flex flex-col overflow-hidden border border-slate-100 relative">
          
          {/* Хедер контентной части */}
          <header className="px-8 py-6 flex justify-between items-center border-b border-slate-50">
            <h1 className="text-2xl font-bold text-slate-800 capitalize">
              {activeTab === 'кадры' ? 'Кадры и Лицензии' : activeTab}
            </h1>
            
            <div className="flex items-center space-x-4">
              {/* Поиск */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Поиск по ФИО или объекту..." 
                  className="pl-10 pr-4 py-2.5 bg-[#F5F6F9] border-none rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7657]/20 w-72 transition-all placeholder:text-slate-400 font-medium"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="p-2.5 bg-[#F5F6F9] rounded-full text-slate-500 hover:text-slate-800 transition-colors relative">
                <Bell className="w-5 h-5" />
                {complianceAlerts.length > 0 && (
                  <span className={`absolute top-2 right-2 w-2 h-2 rounded-full ${primaryBg} border-2 border-[#F5F6F9]`}></span>
                )}
              </button>
            </div>
          </header>

          {/* Рабочая область */}
          <div className="flex-1 overflow-auto p-8 bg-gradient-to-br from-white to-slate-50/50">
            
            {/* --- МОДУЛЬ КАДРЫ И ЛИЦЕНЗИИ --- */}
            {activeTab === 'кадры' && (
              <div className="space-y-4 h-full relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">УЛЧО</p>
                    <p className="text-sm font-semibold text-slate-700">Просрочено: <span className="text-red-600">{complianceSummary.ulchoExpired}</span></p>
                    <p className="text-sm font-semibold text-slate-700">Истекает ≤ 30 дн: <span className="text-yellow-600">{complianceSummary.ulchoExpiring}</span></p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Справка 002/003</p>
                    <p className="text-sm font-semibold text-slate-700">Просрочено: <span className="text-red-600">{complianceSummary.medExpired}</span></p>
                    <p className="text-sm font-semibold text-slate-700">Истекает ≤ 30 дн: <span className="text-yellow-600">{complianceSummary.medExpiring}</span></p>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Периодическая проверка</p>
                    <p className="text-sm font-semibold text-slate-700">Просрочено: <span className="text-red-600">{complianceSummary.periodicExpired}</span></p>
                    <p className="text-sm font-semibold text-slate-700">Истекает ≤ 30 дн: <span className="text-yellow-600">{complianceSummary.periodicExpiring}</span></p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-slate-700">Авто-уведомления по документам</p>
                    <span className="text-xs font-semibold text-slate-400">Всего: {complianceAlerts.length}</span>
                  </div>
                  <div className="max-h-28 overflow-auto space-y-2">
                    {complianceAlerts.length === 0 && (
                      <p className="text-sm text-slate-500">Просрочек и критических истечений нет.</p>
                    )}
                    {complianceAlerts.map((alertItem) => (
                      <div key={alertItem.id} className={`text-xs px-3 py-2 rounded-lg border ${alertItem.level === 'expired' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-yellow-50 text-yellow-700 border-yellow-100'}`}>
                        <span className="font-bold">{alertItem.employeeName}</span>: {alertItem.documentLabel} {alertItem.level === 'expired' ? `просрочен (${alertItem.date})` : `истекает ${alertItem.date} (${alertItem.daysLeft} дн.)`}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={openCreateEmployeeModal}
                    className="inline-flex items-center px-4 py-2.5 bg-[#FF7657] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#e8664a] transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Добавить сотрудника
                  </button>
                </div>

                <div className="flex gap-6 flex-1 relative">
                  {/* ТАБЛИЦА */}
                  <div className={`flex-1 transition-all duration-300 ${selectedEmployee ? 'pr-80' : ''}`}>
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm h-full flex flex-col">
                      <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse relative">
                          <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10">
                            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                              <th className="p-4 pl-6 w-12">
                                <input type="checkbox" className="rounded border-slate-300 text-[#FF7657] focus:ring-[#FF7657]" />
                              </th>
                              <th className="p-4">ФИО Сотрудника</th>
                              <th className="p-4">Текущий пост</th>
                              <th className="p-4">Статус УЛЧО</th>
                              <th className="p-4 text-center">Действия</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {filteredEmployees
                              .map((emp) => (
                              <tr 
                                key={emp.id} 
                                className={`hover:bg-slate-50 transition-colors cursor-pointer group ${selectedEmployee?.id === emp.id ? 'bg-[#FFF0ED]/40' : ''}`}
                                onClick={() => setSelectedEmployee(emp)}
                              >
                                <td className="p-4 pl-6">
                                  <input type="checkbox" className="rounded border-slate-300 text-[#FF7657] focus:ring-[#FF7657]" onClick={e => e.stopPropagation()} />
                                </td>
                                <td className="p-4 font-medium text-slate-800 flex items-center">
                                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold mr-3 group-hover:bg-white transition-colors">
                                    {emp.name.split(' ')[0][0]}{emp.name.split(' ')[1]?.[0] || ''}
                                  </div>
                                  {emp.name}
                                </td>
                                <td className="p-4 text-slate-500 text-sm">{emp.post}</td>
                                <td className="p-4">
                                  {getStatusBadge(emp.licenseDate)}
                                </td>
                                <td className="p-4 text-center">
                                  <button 
                                    className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                                    onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); }}
                                  >
                                    Детали
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ВСПЛЫВАЮЩАЯ ПАНЕЛЬ ДЕТАЛЕЙ (Справа) */}
                {selectedEmployee && (
                  <div className="w-[22rem] max-w-[calc(100vw-1rem)] absolute top-0 right-0 h-full bg-white border border-slate-100 shadow-2xl rounded-3xl p-6 flex flex-col transform transition-transform duration-300 z-20">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 leading-tight pr-4">{selectedEmployee.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">ID: 00{selectedEmployee.id} • Удостоверение охранника</p>
                      </div>
                      <button 
                        onClick={() => setSelectedEmployee(null)}
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-6 flex-1 overflow-auto overflow-x-hidden pr-1">
                      {/* Сводка */}
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500 font-semibold uppercase">Статус лицензии</span>
                          {getStatusBadge(selectedEmployee.licenseDate)}
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/60">
                          <p className="text-xs text-slate-500 mb-1">Мед. справка (002/003-О/у):</p>
                          <div>{getStatusBadge(selectedEmployee.medCheck)}</div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200/60">
                          <p className="text-xs text-slate-500 mb-1">Периодическая проверка:</p>
                          <div>{getStatusBadge(selectedEmployee.periodicCheckDate)}</div>
                        </div>
                      </div>

                      {/* Инфо */}
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Текущий пост</p>
                          <p className="text-sm font-medium text-slate-800 bg-white border border-slate-200 py-2 px-3 rounded-xl shadow-sm">{selectedEmployee.post}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Оружие / Спецсредства</p>
                          <p className="text-sm font-medium text-slate-800">{selectedEmployee.weapon}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Контактный телефон</p>
                          <p className="text-sm font-medium text-slate-800">{selectedEmployee.phone}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3 min-w-0">
                        <p className="text-xs text-slate-500 font-semibold uppercase">Смены сотрудника</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-white border border-slate-200 rounded-lg p-2">
                            <p className="text-slate-400">Смен в неделю</p>
                            <p className="text-sm font-bold text-slate-800">{selectedEmployeeWeeklyShiftCount}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-2">
                            <p className="text-slate-400">Смен в месяц</p>
                            <p className="text-sm font-bold text-slate-800">~ {selectedEmployeeMonthlyShiftCount}</p>
                          </div>
                          <div className="bg-white border border-slate-200 rounded-lg p-2 col-span-2">
                            <p className="text-slate-400">Часов в неделю</p>
                            <p className="text-sm font-bold text-slate-800">{selectedEmployeeSchedule?.hours ?? 0} ч</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {weekDays.map((day, dayIndex) => (
                            <div key={dayIndex} className="flex items-center justify-between gap-2 min-w-0">
                              <span className="text-xs font-semibold text-slate-500 w-14">{day.day} {day.date}</span>
                              <select
                                value={selectedEmployeeSchedule?.shifts[dayIndex] ?? 'off'}
                                onChange={(event) => setProfileShift(selectedEmployee, dayIndex, event.target.value as ShiftType)}
                                className="flex-1 min-w-0 w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
                              >
                                <option value="off">Выходной</option>
                                <option value="day">День (08:00-20:00)</option>
                                <option value="night">Ночь (20:00-08:00)</option>
                                <option value="24h">Сутки (24ч)</option>
                              </select>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-200/70">
                          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-2">Ручное добавление смены</p>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={manualShiftDayIndex}
                              onChange={(event) => setManualShiftDayIndex(Number(event.target.value))}
                              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 min-w-0"
                            >
                              {weekDays.map((day, dayIndex) => (
                                <option key={dayIndex} value={dayIndex}>{day.day} {day.date}</option>
                              ))}
                            </select>
                            <select
                              value={manualShiftType}
                              onChange={(event) => setManualShiftType(event.target.value as ShiftType)}
                              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 min-w-0"
                            >
                              <option value="day">День</option>
                              <option value="night">Ночь</option>
                              <option value="24h">Сутки</option>
                              <option value="off">Выходной</option>
                            </select>
                            <button
                              onClick={() => addManualShiftForEmployee(selectedEmployee)}
                              className="px-2 py-1 text-xs font-bold bg-[#FF7657] text-white rounded-lg hover:bg-[#e8664a] whitespace-nowrap"
                            >
                              Добавить
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Кнопки действий */}
                    <div className="pt-6 border-t border-slate-100 space-y-2 mt-auto">
                      <button
                        onClick={openEditProfileModal}
                        className={`w-full py-3 ${primaryBg} text-white rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition-opacity flex justify-center items-center`}
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Редактировать профиль
                      </button>
                      <button
                        onClick={() => showToast('Досье сформировано и отправлено на печать')}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                      >
                        Скачать досье (PDF)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- МОДУЛЬ ДАШБОРДА --- */}
            {activeTab === 'дашборд' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Посты под охраной</p>
                      <Shield className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{staffedPosts} / {activePostsCount}</p>
                    <p className={`text-sm font-semibold mt-1 ${emptyPosts > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {emptyPosts > 0 ? `${emptyPosts} требуют закрытия` : 'Все посты закрыты'}
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Контроль допусков</p>
                      <AlertTriangle className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{highRiskDocuments + mediumRiskDocuments}</p>
                    <p className="text-sm font-semibold mt-1 text-slate-600">
                      <span className="text-red-600">{highRiskDocuments} просрочено</span>, <span className="text-yellow-600">{mediumRiskDocuments} истекает</span>
                    </p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Оружие на руках</p>
                      <Target className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{issuedWeaponsCount}</p>
                    <p className="text-sm font-semibold mt-1 text-slate-600">В КХО: {khoWeapons.filter((weapon) => weapon.inKho).length}</p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs uppercase tracking-wider font-bold text-slate-400">Авто-уведомления</p>
                      <Bell className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-black text-slate-800">{complianceAlerts.length}</p>
                    <p className="text-sm font-semibold mt-1 text-slate-600">Кадры и лицензии</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800">Приоритетные задачи смены</h3>
                      <button
                        onClick={() => setActiveTab('кадры')}
                        className="text-sm font-semibold text-[#FF7657] hover:bg-[#FFF0ED] px-3 py-1.5 rounded-xl transition-colors"
                      >
                        Открыть кадровый модуль
                      </button>
                    </div>
                    <div className="space-y-3">
                      {dashboardTasks.map((task) => (
                        <div key={task.id} className={`p-4 rounded-2xl border ${
                          task.severity === 'high'
                            ? 'bg-red-50 border-red-100'
                            : task.severity === 'medium'
                              ? 'bg-yellow-50 border-yellow-100'
                              : 'bg-green-50 border-green-100'
                        }`}>
                          <p className="text-sm font-bold text-slate-800 mb-1">{task.title}</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{task.desc}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <button onClick={() => setActiveTab('графики')} className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                        Графики и замены
                      </button>
                      <button onClick={() => setActiveTab('кхо')} className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                        Процессы КХО
                      </button>
                      <button onClick={() => setActiveTab('объекты')} className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                        Объекты и посты
                      </button>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Ближайшие риски по документам</h3>
                    <div className="space-y-2 max-h-[380px] overflow-auto">
                      {complianceAlerts.slice(0, 10).map((alertItem) => (
                        <div key={alertItem.id} className={`p-3 rounded-xl border ${
                          alertItem.level === 'expired'
                            ? 'bg-red-50 border-red-100'
                            : 'bg-yellow-50 border-yellow-100'
                        }`}>
                          <p className="text-xs font-bold text-slate-800 mb-0.5">{alertItem.employeeName}</p>
                          <p className="text-xs text-slate-600">{alertItem.documentLabel}: {alertItem.date}</p>
                          <p className={`text-[11px] font-bold mt-1 ${alertItem.level === 'expired' ? 'text-red-700' : 'text-yellow-700'}`}>
                            {alertItem.level === 'expired' ? 'Просрочено' : `Осталось ${alertItem.daysLeft} дн.`}
                          </p>
                        </div>
                      ))}
                      {complianceAlerts.length === 0 && (
                        <div className="p-3 rounded-xl border bg-green-50 border-green-100">
                          <p className="text-xs font-semibold text-green-700">Критических рисков не обнаружено</p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveTab('кадры')}
                      className="w-full mt-4 py-3 bg-[#F5F6F9] text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                    >
                      Перейти в Кадры и Лицензии
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Сменный контур</p>
                    <p className="text-2xl font-black text-slate-800 mb-1">{schedule.length}</p>
                    <p className="text-sm text-slate-500">сотрудников в активном графике на неделю</p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Объекты в реестре</p>
                    <p className="text-2xl font-black text-slate-800 mb-1">{objects.length}</p>
                    <p className="text-sm text-slate-500">объектов, {activePostsCount} постов охраны</p>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Журнал КХО</p>
                    <p className="text-2xl font-black text-slate-800 mb-1">{khoJournal.length}</p>
                    <p className="text-sm text-slate-500">операций в книге приема-выдачи</p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'объекты' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <span className="p-2 bg-[#FFF0ED] text-[#FF7657] rounded-xl"><Building className="w-5 h-5" /></span>
                    <h2 className="text-lg font-bold text-slate-800">Реестр объектов ({objects.length})</h2>
                  </div>
                  <button
                    onClick={addObject}
                    className="flex items-center px-4 py-2.5 bg-[#FF7657] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#e8664a] transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Добавить объект
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                  {filteredObjects.map((obj) => (
                    <div key={obj.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden relative">
                      <div className="p-6 border-b border-slate-50 flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#FF7657] bg-[#FFF0ED] px-2 py-0.5 rounded-md">{obj.type}</span>
                            <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>Охраняется
                            </span>
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mt-2">{obj.name}</h3>
                          <p className="text-sm text-slate-500 flex items-center mt-1">
                            <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" /> {obj.address}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveObjectMenuId((prev) => (prev === obj.id ? null : obj.id))}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                      {activeObjectMenuId === obj.id && (
                        <div className="absolute right-6 top-16 bg-white border border-slate-100 rounded-xl shadow-xl p-2 z-20 w-44">
                          <button onClick={() => openObjectEditModal(obj.id)} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50">Редактировать</button>
                          <button onClick={() => deleteObject(obj.id)} className="w-full text-left px-3 py-2 text-sm rounded-lg text-red-600 hover:bg-red-50">Удалить объект</button>
                        </div>
                      )}

                      <div className="p-6 bg-slate-50/50 flex-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex justify-between">
                          <span>Активные посты</span>
                          <span className="bg-slate-200 text-slate-600 px-2 rounded-full">{obj.postsCount}</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {obj.posts.map((post, idx) => (
                            <div key={idx} className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 shadow-sm">
                              <Shield className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                              <div className="leading-tight">
                                <div>{post}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  {postAssignments[obj.id]?.[post]
                                    ? `Назначен: ${employees.find((employee) => employee.id === postAssignments[obj.id][post])?.name ?? '—'}`
                                    : 'Не назначен'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-white border-t border-slate-50 grid grid-cols-3 gap-2">
                        <button
                          onClick={() => openObjectPassport(obj)}
                          className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <FileSignature className={`w-5 h-5 mb-1 ${obj.passport === 'valid' ? 'text-green-500' : obj.passport === 'updating' ? 'text-yellow-500' : 'text-red-500'}`} />
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 text-center leading-tight">Паспорт<br/>объекта</span>
                        </button>
                        <button
                          onClick={() => openInstructionsModal(obj.id)}
                          className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <BookOpen className="w-5 h-5 mb-1 text-slate-400 group-hover:text-[#FF7657]" />
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 text-center leading-tight">Инструкции<br/>постов</span>
                        </button>
                        <button
                          onClick={() => showObjectMap(obj.name, obj.address)}
                          className="flex flex-col items-center justify-center p-2 rounded-xl hover:bg-slate-50 transition-colors group"
                        >
                          <Map className="w-5 h-5 mb-1 text-slate-400 group-hover:text-[#FF7657]" />
                          <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-700 text-center leading-tight">Схема<br/>территории</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- МОДУЛЬ ГРАФИКИ И СМЕНЫ --- */}
            {activeTab === 'графики' && (
              <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center bg-white p-4 rounded-t-3xl border border-slate-100 border-b-0 shadow-sm z-10">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-[#F5F6F9] rounded-xl p-1">
                      <button className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:shadow-sm transition-all"><ChevronLeft className="w-5 h-5" /></button>
                      <span className="px-4 font-bold text-slate-700 flex items-center">
                        <CalendarDays className="w-4 h-4 mr-2 text-[#FF7657]" /> 
                        10 - 16 Ноября 2025
                      </span>
                      <button className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:shadow-sm transition-all"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                    
                    <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                      <Filter className="w-4 h-4 mr-2 text-slate-400" /> Все объекты
                    </button>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center text-xs font-medium text-slate-400 mr-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span> День
                      <span className="w-2 h-2 rounded-full bg-indigo-500 mr-1.5 ml-3"></span> Ночь
                      <span className="w-2 h-2 rounded-full bg-[#FF7657] mr-1.5 ml-3"></span> Сутки
                    </div>
                    <button
                      onClick={autoArrangeSchedule}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors"
                    >
                      Авто-расстановка
                    </button>
                    <button
                      onClick={publishSchedule}
                      className="px-5 py-2 bg-[#FF7657] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#e8664a] transition-colors"
                    >
                      Опубликовать табель
                    </button>
                  </div>
                </div>
                {publishedAt && (
                  <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-semibold px-4 py-2 rounded-b-xl">
                    Табель опубликован: {publishedAt}
                  </div>
                )}

                <div className="flex-1 overflow-auto bg-white rounded-b-3xl border border-slate-100 shadow-sm relative">
                  <table className="w-full text-left border-collapse min-w-[1000px]">
                    <thead className="sticky top-0 bg-white z-20 shadow-sm">
                      <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400 font-bold">
                        <th className="p-4 pl-6 w-64 sticky left-0 bg-white z-30 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          Сотрудник / Объект
                        </th>
                        {weekDays.map((day, idx) => (
                          <th key={idx} className={`p-4 text-center border-r border-slate-50 min-w-[120px] ${day.isWeekend ? 'bg-red-50/50 text-red-400' : 'bg-slate-50/50'}`}>
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] mb-0.5">{day.day}</span>
                              <span className="text-sm text-slate-700">{day.date}</span>
                            </div>
                          </th>
                        ))}
                        <th className="p-4 text-center w-24 bg-slate-50/50">Часы</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {schedule.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4 pl-6 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-500 font-bold mr-3">
                                {emp.name.split(' ')[0][0]}{emp.name.split(' ')[1]?.[0] || ''}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-sm">{emp.name}</p>
                                <select
                                  value={schedulePostOptions.find((option) => option.label === emp.post)?.value ?? '__current__'}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => {
                                    if (event.target.value === '__current__') {
                                      return;
                                    }
                                    assignScheduleEmployeeToPost(emp, event.target.value);
                                  }}
                                  className="mt-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-600 max-w-[220px]"
                                >
                                  {!schedulePostOptions.find((option) => option.label === emp.post) && (
                                    <option value="__current__">{emp.post}</option>
                                  )}
                                  {schedulePostOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </td>
                          {emp.shifts.map((shift, idx) => (
                            <td
                              key={idx}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => onShiftDrop(emp.id, idx)}
                              className={`p-2 border-r border-slate-50 text-center ${weekDays[idx].isWeekend ? 'bg-red-50/20' : ''} ${
                                draggedCell ? 'hover:bg-emerald-50/70' : ''
                              }`}
                            >
                              {renderShiftBadge(shift, {
                                draggable: shift !== 'off',
                                onDragStart: () => onShiftDragStart(emp.id, idx),
                                onDragEnd: () => setDraggedCell(null),
                              })}
                            </td>
                          ))}
                          <td className="p-4 text-center font-bold text-slate-700">
                            <span className={emp.hours > 40 ? 'text-[#FF7657]' : ''}>{emp.hours}</span> ч
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="sticky bottom-0 bg-white/80 backdrop-blur-sm border-t border-slate-100 p-3 text-center text-xs text-slate-400">
                    Подсказка: Вы можете перетаскивать карточки смен (Drag & Drop) между ячейками для быстрой замены охранников.
                  </div>
                </div>
              </div>
            )}

            {/* --- МОДУЛЬ КХО (ОРУЖЕЙКА) --- */}
            {activeTab === 'кхо' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <span className="p-2 bg-[#FFF0ED] text-[#FF7657] rounded-xl"><Lock className="w-5 h-5" /></span>
                    <div>
                      <h2 className="text-lg font-bold text-slate-800">КХО: Центральный офис</h2>
                      <p className="text-xs text-slate-400">Ответственный: Николаев А.В. (Нач. Охраны)</p>
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowKhoArchive((prev) => !prev)}
                      className="flex items-center px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      <History className="w-4 h-4 mr-2 text-slate-400" /> Архив выдач
                    </button>
                    <button
                      onClick={() => showToast('Книга учета сформирована (демо)')}
                      className="flex items-center px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm shadow-md hover:bg-slate-700 transition-colors"
                    >
                      <Printer className="w-4 h-4 mr-2 text-slate-300" /> Книга учета для РГ (PDF)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center hover:shadow-md transition-shadow">
                    <div className="p-4 rounded-2xl mr-4 bg-green-50 text-green-600"><Target className="w-6 h-6" /></div>
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Оружие в КХО</h4>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-black text-slate-800">{khoWeapons.filter((w) => w.inKho).length} / {khoWeapons.length}</span>
                        <span className="text-xs font-medium text-slate-500">{khoInHands.length} ед. на руках</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center hover:shadow-md transition-shadow">
                    <div className="p-4 rounded-2xl mr-4 bg-blue-50 text-blue-600"><Activity className="w-6 h-6" /></div>
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Патроны (шт)</h4>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-black text-slate-800">{khoAmmoReserve}</span>
                        <span className="text-xs font-medium text-slate-500">на складе</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center hover:shadow-md transition-shadow">
                    <div className="p-4 rounded-2xl mr-4 bg-indigo-50 text-indigo-600"><Shield className="w-6 h-6" /></div>
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Активных выдач</h4>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-black text-slate-800">{khoInHands.length}</span>
                        <span className="text-xs font-medium text-slate-500">в текущей смене</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center hover:shadow-md transition-shadow">
                    <div className="p-4 rounded-2xl mr-4 bg-red-50 text-red-600"><Clock className="w-6 h-6" /></div>
                    <div>
                      <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Документы не в норме</h4>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-black text-slate-800">{employees.filter((e) => !(
                          getDocumentStatus(e.licenseDate) === 'valid' &&
                          getDocumentStatus(e.medCheck) === 'valid' &&
                          getDocumentStatus(e.periodicCheckDate) === 'valid'
                        )).length}</span>
                        <span className="text-xs font-medium text-slate-500">выдача блокируется</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-fit">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                      <RotateCcw className="w-5 h-5 mr-2 text-[#FF7657]" /> Выдача / Прием
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Сотрудник (ФИО или ID)</label>
                        <select
                          value={khoForm.employeeId}
                          onChange={(event) => setKhoForm((prev) => ({ ...prev, employeeId: event.target.value }))}
                          className="w-full bg-[#F5F6F9] border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#FF7657]/20 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Выберите охранника...</option>
                          {employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name} (УЛЧО {getDocumentStatus(employee.licenseDate) === 'valid' ? 'Активно' : 'Проблема'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Оружие / Спецсредство</label>
                        <select
                          value={khoForm.weaponId}
                          onChange={(event) => setKhoForm((prev) => ({ ...prev, weaponId: event.target.value }))}
                          className="w-full bg-[#F5F6F9] border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#FF7657]/20 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Сканируйте штрихкод или выберите...</option>
                          {khoWeapons.map((weapon) => (
                            <option key={weapon.id} value={weapon.id}>
                              {weapon.label} {weapon.inKho ? '(в КХО)' : '(на руках)'}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex space-x-4">
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Патроны (шт)</label>
                          <input
                            type="number"
                            value={khoForm.ammo}
                            min={0}
                            onChange={(event) => setKhoForm((prev) => ({ ...prev, ammo: event.target.value }))}
                            className="w-full bg-[#F5F6F9] border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-[#FF7657]/20 transition-all"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Статус проверки</label>
                          <div className={`w-full rounded-xl px-4 py-3 text-sm font-bold flex items-center border ${
                            selectedKhoEmployeeHasAccess ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                          }`}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> {selectedKhoEmployeeHasAccess ? 'Допуск есть' : 'Допуск отсутствует'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 space-y-3">
                      <button
                        onClick={handleKhoIssue}
                        className="w-full py-3.5 bg-[#FF7657] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#e8664a] transition-colors flex justify-center items-center"
                      >
                        Выдать со склада
                      </button>
                      <button
                        onClick={handleKhoReturn}
                        className="w-full py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex justify-center items-center"
                      >
                        Принять на склад
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                      <h3 className="text-lg font-bold text-slate-800">
                        Книга приема-выдачи ({showKhoArchive ? 'архив' : 'за сегодня'})
                      </h3>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={khoFilterQuery}
                          onChange={(event) => setKhoFilterQuery(event.target.value)}
                          placeholder="Фильтр по ФИО/оружию"
                          className="pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 z-10">
                          <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                            <th className="p-4 pl-6">Выдано</th>
                            <th className="p-4">Сдано</th>
                            <th className="p-4">Сотрудник</th>
                            <th className="p-4">Оружие / Патроны</th>
                            <th className="p-4 text-center">Статус</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {khoVisibleJournal.map((record) => (
                            <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 pl-6 text-sm font-bold text-slate-700">{record.timeOut}</td>
                              <td className="p-4 text-sm font-medium text-slate-400">{record.timeIn}</td>
                              <td className="p-4 font-bold text-slate-800 text-sm">{record.employee}</td>
                              <td className="p-4 text-sm text-slate-600">
                                <span className="font-semibold">{record.weapon}</span>
                                {record.ammo !== '-' && <span className="text-xs text-slate-400 ml-2">({record.ammo})</span>}
                              </td>
                              <td className="p-4 text-center">
                                {record.status === 'issued' ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FFF0ED] text-[#FF7657] uppercase tracking-wider">
                                    На руках
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-600 uppercase tracking-wider">
                                    Сдано
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- МОДУЛЬ НАСТРОЕК --- */}
            {activeTab === 'настройки' && (
              <div className="flex gap-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Левое внутреннее меню настроек */}
                <div className="w-64 flex flex-col space-y-2">
                  {[
                    { id: 'integrations', label: 'Интеграции', icon: Zap },
                    { id: 'company', label: 'Реквизиты ЧОО', icon: Building },
                    { id: 'roles', label: 'Роли и права (RBAC)', icon: Key },
                    { id: 'notifications', label: 'Уведомления', icon: Bell },
                    { id: 'system', label: 'Системные', icon: Sliders },
                  ].map((item, idx) => (
                    <button 
                      key={item.id}
                      className={`flex items-center px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                        idx === 0 
                          ? 'bg-slate-800 text-white shadow-md' 
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      <item.icon className={`w-4 h-4 mr-3 ${idx === 0 ? 'text-slate-300' : 'text-slate-400'}`} />
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Основная рабочая область настроек (Интеграции) */}
                <div className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 overflow-auto h-fit">
                  
                  <div className="mb-8">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Внешние интеграции</h2>
                    <p className="text-sm text-slate-500">
                      Управление подключением к сторонним сервисам
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {mockIntegrations.map((integration) => (
                      <div key={integration.id} className={`p-6 rounded-3xl border ${integration.status === 'connected' ? 'border-[#FF7657]/20 bg-[#FFF0ED]/20' : 'border-slate-100 bg-white'} shadow-sm transition-all hover:shadow-md flex flex-col`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className={`p-3 rounded-2xl ${integration.bg} ${integration.color}`}>
                            <integration.icon className="w-6 h-6" />
                          </div>
                          
                          {/* Имитация Toggle-переключателя */}
                          <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${integration.status === 'connected' ? 'bg-[#FF7657]' : 'bg-slate-200'}`}>
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${integration.status === 'connected' ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>

                        <h3 className="text-lg font-bold text-slate-800 mb-1">{integration.name}</h3>
                        <p className="text-sm font-medium text-slate-500 flex-1 mb-6">{integration.desc}</p>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-slate-100/60">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Статус</p>
                            {integration.status === 'connected' ? (
                              <p className="text-xs font-bold text-green-600 flex items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span> Подключено
                              </p>
                            ) : (
                              <p className="text-xs font-bold text-slate-400 flex items-center">
                                Отключено
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Синхронизация</p>
                            <p className="text-xs font-semibold text-slate-700">{integration.lastSync}</p>
                          </div>
                        </div>
                        
                        {/* Кнопка настройки, если подключено */}
                        {integration.status === 'connected' && (
                          <button className="mt-4 w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors">
                            Настроить параметры
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}

            {/* --- ЗАГЛУШКА ДЛЯ ОСТАЛЬНЫХ МОДУЛЕЙ --- */}
            {/* Удалили заглушку для КХО, так как модуль готов */}

          </div>
        </div>
      </main>

      {isEmployeeCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Новый сотрудник</h3>
              <button
                onClick={() => setIsEmployeeCreateOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-slate-600">
                ФИО
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.name}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, name: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Телефон
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.phone}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Оружие / спецсредство
                <select
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.weaponId}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, weaponId: event.target.value }))}
                >
                  <option value="">Без оружия</option>
                  {availableKhoWeaponsForHiring.map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>
                      {weapon.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-600">
                УЛЧО до
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.licenseDate}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, licenseDate: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Справка 002/003 до
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.medCheck}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, medCheck: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Периодическая проверка до
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.periodicCheckDate}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, periodicCheckDate: event.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Шаблон графика
                <select
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={newEmployeeDraft.scheduleTemplate}
                  onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, scheduleTemplate: event.target.value as ScheduleTemplate }))}
                >
                  <option value="2/2 день">2/2 день</option>
                  <option value="2/2 ночь">2/2 ночь</option>
                  <option value="сутки/двое">сутки/двое</option>
                  <option value="5/2 день">5/2 день</option>
                </select>
              </label>
            </div>

            <label className="mt-4 inline-flex items-center text-sm font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={newEmployeeDraft.addToSchedule}
                onChange={(event) => setNewEmployeeDraft((prev) => ({ ...prev, addToSchedule: event.target.checked }))}
                className="mr-2 rounded border-slate-300 text-[#FF7657] focus:ring-[#FF7657]"
              />
              Сразу добавить в график дежурств
            </label>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsEmployeeCreateOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={createEmployee}
                className="px-5 py-2.5 rounded-xl bg-[#FF7657] text-white font-bold hover:bg-[#e8664a]"
              >
                Создать сотрудника
              </button>
            </div>
          </div>
        </div>
      )}

      {isProfileEditOpen && profileDraft && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Редактирование профиля</h3>
              <button
                onClick={() => setIsProfileEditOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-slate-600">
                ФИО
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.name}
                  onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Текущий пост
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.post}
                  onChange={(event) => setProfileDraft({ ...profileDraft, post: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Телефон
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.phone}
                  onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Оружие / спецсредство
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.weapon}
                  onChange={(event) => setProfileDraft({ ...profileDraft, weapon: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Дата УЛЧО
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.licenseDate}
                  onChange={(event) => setProfileDraft({ ...profileDraft, licenseDate: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Мед. справка до
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.medCheck}
                  onChange={(event) => setProfileDraft({ ...profileDraft, medCheck: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Периодическая проверка до
                <input
                  type="date"
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={profileDraft.periodicCheckDate}
                  onChange={(event) => setProfileDraft({ ...profileDraft, periodicCheckDate: event.target.value })}
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsProfileEditOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={saveProfile}
                className="px-5 py-2.5 rounded-xl bg-[#FF7657] text-white font-bold hover:bg-[#e8664a]"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {isObjectEditOpen && objectDraft && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">
                {objectEditorMode === 'create' ? 'Создание объекта' : 'Редактирование объекта'}
              </h3>
              <button
                onClick={() => setIsObjectEditOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-sm font-semibold text-slate-600">
                Название объекта
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={objectDraft.name}
                  onChange={(event) => setObjectDraft({ ...objectDraft, name: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Тип объекта
                <select
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={objectTypeOptions.includes(objectDraft.type) ? objectDraft.type : '__custom__'}
                  onChange={(event) => {
                    if (event.target.value === '__custom__') {
                      setObjectDraft({ ...objectDraft, type: '' });
                      return;
                    }
                    setObjectDraft({ ...objectDraft, type: event.target.value });
                  }}
                >
                  {objectTypeOptions.map((typeName) => (
                    <option key={typeName} value={typeName}>{typeName}</option>
                  ))}
                  <option value="__custom__">Новый тип...</option>
                </select>
              </label>
              {!objectTypeOptions.includes(objectDraft.type) && (
                <label className="text-sm font-semibold text-slate-600">
                  Новый тип
                  <input
                    className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                    placeholder="Введите новый тип объекта"
                    value={objectDraft.type}
                    onChange={(event) => setObjectDraft({ ...objectDraft, type: event.target.value })}
                  />
                </label>
              )}
              <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                Адрес
                <input
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={objectDraft.address}
                  onChange={(event) => setObjectDraft({ ...objectDraft, address: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600 md:col-span-2">
                Посты (по одному на строку)
                <textarea
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5 min-h-28"
                  value={objectDraft.posts.join('\n')}
                  onChange={(event) => {
                    const nextPosts = event.target.value.split('\n');
                    setObjectDraft({ ...objectDraft, posts: nextPosts, postsCount: nextPosts.filter(Boolean).length });
                  }}
                />
              </label>
              <label className="text-sm font-semibold text-slate-600">
                Статус паспорта
                <select
                  className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5"
                  value={objectDraft.passport}
                  onChange={(event) =>
                    setObjectDraft({
                      ...objectDraft,
                      passport: event.target.value as SecurityObject['passport'],
                    })
                  }
                >
                  <option value="valid">Действует</option>
                  <option value="updating">На обновлении</option>
                  <option value="missing">Отсутствует</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsObjectEditOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
              >
                Отмена
              </button>
              <button
                onClick={saveObject}
                className="px-5 py-2.5 rounded-xl bg-[#FF7657] text-white font-bold hover:bg-[#e8664a]"
              >
                {objectEditorMode === 'create' ? 'Создать объект' : 'Сохранить объект'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isInstructionsOpen && activeInstructionsObjectId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-800">Инструкции постов</h3>
              <button
                onClick={() => setIsInstructionsOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
              {instructionsDraft.map((item, idx) => (
                <div key={`${item.post}-${idx}`} className="border border-slate-200 rounded-2xl p-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Пост
                    <input
                      className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700"
                      value={item.post}
                      onChange={(event) =>
                        setInstructionsDraft((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, post: event.target.value } : entry
                          )
                        )
                      }
                    />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-3 block">
                    Инструкция
                    <textarea
                      className="mt-2 w-full bg-[#F5F6F9] border border-slate-200 rounded-xl px-4 py-2.5 min-h-24 text-sm text-slate-700"
                      value={item.instruction}
                      onChange={(event) =>
                        setInstructionsDraft((prev) =>
                          prev.map((entry, entryIdx) =>
                            entryIdx === idx ? { ...entry, instruction: event.target.value } : entry
                          )
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-between gap-3">
              <button
                onClick={() =>
                  setInstructionsDraft((prev) => [...prev, { post: `Пост ${prev.length + 1}`, instruction: '' }])
                }
                className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Добавить пост
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsInstructionsOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 font-semibold hover:bg-slate-200"
                >
                  Отмена
                </button>
                <button
                  onClick={saveInstructions}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7657] text-white font-bold hover:bg-[#e8664a]"
                >
                  Сохранить инструкции
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {passportObject && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-800">Паспорт объекта</h3>
              <button
                onClick={() => setPassportObject(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Объект</p>
                <p className="font-semibold text-slate-800">{passportObject.name}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Тип</p>
                <p className="font-semibold text-slate-800">{passportObject.type}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Адрес</p>
                <p className="font-semibold text-slate-800">{passportObject.address}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Посты охраны</p>
                <ul className="list-disc pl-5 text-slate-700">
                  {passportObject.posts.map((postName) => (
                    <li key={postName}>{postName}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setPassportObject(null)}
                className="px-4 py-2.5 rounded-xl bg-[#FF7657] text-white font-bold hover:bg-[#e8664a]"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-sm font-semibold px-4 py-3 rounded-xl shadow-xl">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
