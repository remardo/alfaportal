import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  DollarSign,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Settings,
  Shield,
  Target,
  Users,
} from 'lucide-react';
import type {
  DashboardStat,
  Employee,
  Integration,
  JournalRecord,
  KhoStat,
  RecentAlert,
  ScheduleEntry,
  SecurityObject,
  WeekDay,
} from '../domain/entities';

export const mockEmployees: Employee[] = [
  { id: 1, name: 'Иванов Сергей Петрович', post: 'БЦ "Палладиум" (Пост 1)', licenseDate: '2026-10-15', status: 'valid', phone: '+7 (999) 123-45-67', medCheck: '2026-09-01', periodicCheckDate: '2026-12-11', weapon: 'ИЖ-71 (Разрешено)' },
  { id: 2, name: 'Смирнов Алексей Ильич', post: 'Индустриальный парк', licenseDate: '2026-03-18', status: 'expiring', phone: '+7 (900) 555-22-33', medCheck: '2026-03-10', periodicCheckDate: '2026-04-01', weapon: 'Без оружия' },
  { id: 3, name: 'Кузнецов Дмитрий А.', post: 'ТРЦ "Мадагаскар" (ГБР)', licenseDate: '2025-12-05', status: 'expired', phone: '+7 (911) 222-33-44', medCheck: '2026-01-15', periodicCheckDate: '2026-01-20', weapon: 'Сайга-410К (Приостановлено)' },
  { id: 4, name: 'Попов Николай В.', post: 'Резерв', licenseDate: '2026-08-20', status: 'valid', phone: '+7 (922) 333-44-55', medCheck: '2026-06-20', periodicCheckDate: '2026-09-30', weapon: 'МР-471 (Разрешено)' },
  { id: 5, name: 'Соколов Андрей М.', post: 'ЖК "Альбатрос"', licenseDate: '2026-04-11', status: 'valid', phone: '+7 (933) 444-55-66', medCheck: '2026-03-06', periodicCheckDate: '2026-03-14', weapon: 'Без оружия' },
  { id: 6, name: 'Лебедев Виктор С.', post: 'БЦ "Палладиум" (Пост 2)', licenseDate: '2026-02-28', status: 'expiring', phone: '+7 (944) 555-66-77', medCheck: '2026-02-15', periodicCheckDate: '2026-02-20', weapon: 'Палка резиновая (ПР-73)' },
];

export const dashboardStats: DashboardStat[] = [
  { id: 1, title: 'Выручка (мес)', value: '12.4 млн ₽', trend: '+8.2%', isPositive: true, icon: DollarSign },
  { id: 2, title: 'Штрафы (мес)', value: '45 000 ₽', trend: '-12%', isPositive: true, icon: Activity },
  { id: 3, title: 'Свободный резерв', value: '14 чел.', trend: 'В норме', isPositive: true, icon: Users },
  { id: 4, title: 'Активные посты', value: '82 / 85', trend: '3 пустуют', isPositive: false, icon: Shield },
];

export const recentAlerts: RecentAlert[] = [
  { id: 1, type: 'sos', title: 'SOS: Тревожная кнопка', desc: 'БЦ "Палладиум", Пост 1. Выслана ГБР.', time: '10 мин назад', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  { id: 2, type: 'warning', title: 'Истекает УЛЧО', desc: 'Смирнов А.И. — осталось 5 дней.', time: '2 часа назад', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  { id: 3, type: 'info', title: 'Смена закрыта', desc: 'ЖК "Альбатрос", без происшествий.', time: '5 часов назад', color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 },
];

export const mockObjects: SecurityObject[] = [
  { id: 1, name: 'БЦ "Палладиум"', type: 'Бизнес-центр', address: 'Президентский б-р, 20', postsCount: 3, posts: ['Главный вход', 'Паркинг', 'Видеонаблюдение'], status: 'active', passport: 'valid' },
  { id: 2, name: 'ТРЦ "Мадагаскар"', type: 'Торговый центр', address: 'ул. Лен. Комсомола, 21А', postsCount: 5, posts: ['Вход 1', 'Вход 2', 'Зона разгрузки', 'Паркинг', 'Патруль'], status: 'active', passport: 'valid' },
  { id: 3, name: 'ЖК "Альбатрос"', type: 'Жилой комплекс', address: 'пл. Речников, 7', postsCount: 2, posts: ['КПП', 'Патруль территории'], status: 'active', passport: 'updating' },
  { id: 4, name: 'Индустриальный парк', type: 'Промзона', address: 'пр. Тракторостроителей, 101', postsCount: 1, posts: ['Главный КПП'], status: 'active', passport: 'missing' },
];

export const weekDays: WeekDay[] = [
  { date: '10', day: 'Пн', isWeekend: false },
  { date: '11', day: 'Вт', isWeekend: false },
  { date: '12', day: 'Ср', isWeekend: false },
  { date: '13', day: 'Чт', isWeekend: false },
  { date: '14', day: 'Пт', isWeekend: false },
  { date: '15', day: 'Сб', isWeekend: true },
  { date: '16', day: 'Вс', isWeekend: true },
];

export const mockSchedule: ScheduleEntry[] = [
  { id: 1, name: 'Иванов С.П.', post: 'БЦ "Палладиум" (Пост 1)', shifts: ['day', 'day', 'off', 'off', 'night', 'night', 'off'], hours: 48 },
  { id: 2, name: 'Смирнов А.И.', post: 'Индустриальный парк', shifts: ['24h', 'off', 'off', '24h', 'off', 'off', '24h'], hours: 72 },
  { id: 3, name: 'Кузнецов Д.А.', post: 'ТРЦ "Мадагаскар" (ГБР)', shifts: ['day', 'night', 'off', 'day', 'night', 'off', 'off'], hours: 48 },
  { id: 4, name: 'Попов Н.В.', post: 'Резерв', shifts: ['off', 'off', 'day', 'day', 'day', 'day', 'day'], hours: 60 },
  { id: 5, name: 'Соколов А.М.', post: 'ЖК "Альбатрос"', shifts: ['24h', 'off', 'off', '24h', 'off', 'off', 'off'], hours: 48 },
  { id: 6, name: 'Лебедев В.С.', post: 'БЦ "Палладиум" (Пост 2)', shifts: ['night', 'night', 'off', 'off', 'day', 'day', 'off'], hours: 48 },
];

export const khoStats: KhoStat[] = [
  { id: 1, title: 'Оружие в КХО', value: '42 / 50', desc: '8 ед. на руках', icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
  { id: 2, title: 'Патроны (шт)', value: '1 250', desc: 'Резерв в норме', icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 3, title: 'Спецсредства', value: '120', desc: 'ПР-73, Наручники', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 4, title: 'Требуют ТО / В ремонте', value: '2 ед.', desc: 'ИЖ-71 (№12, №14)', icon: Settings, color: 'text-red-600', bg: 'bg-red-50' },
];

export const mockJournal: JournalRecord[] = [
  { id: 1, timeOut: '07:45', timeIn: '-', employee: 'Иванов С.П.', weapon: 'ИЖ-71 (№ 0451)', ammo: '16 шт.', status: 'issued' },
  { id: 2, timeOut: '07:50', timeIn: '-', employee: 'Кузнецов Д.А.', weapon: 'Сайга-410К (№ 1102)', ammo: '20 шт.', status: 'issued' },
  { id: 3, timeOut: '19:55 (вчера)', timeIn: '08:05', employee: 'Смирнов А.И.', weapon: 'ПР-73 (№ 44)', ammo: '-', status: 'returned' },
  { id: 4, timeOut: '08:15', timeIn: '-', employee: 'Соколов А.М.', weapon: 'МР-471 (№ 0099)', ammo: '8 шт.', status: 'issued' },
  { id: 5, timeOut: '08:30', timeIn: '-', employee: 'Лебедев В.С.', weapon: 'ПР-73 (№ 12)', ammo: '-', status: 'issued' },
];

export const mockIntegrations: Integration[] = [
  { id: 1, name: '1С:ЗУП 8.3', desc: 'Двусторонний обмен: Кадры, Табель учета', status: 'connected', lastSync: '10 мин назад', icon: Database, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  { id: 2, name: 'Wialon GPS', desc: 'Отслеживание машин ГБР на карте портала', status: 'connected', lastSync: 'В реальном времени', icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
  { id: 3, name: 'Telegram Бот', desc: 'Уведомления о тревогах и заменах', status: 'connected', lastSync: 'Активен', icon: MessageSquare, color: 'text-sky-600', bg: 'bg-sky-50' },
  { id: 4, name: 'Mango Office', desc: 'IP-телефония, click-to-call из карточки', status: 'disconnected', lastSync: '-', icon: Phone, color: 'text-slate-500', bg: 'bg-slate-100' },
  { id: 5, name: '1С:Бухгалтерия', desc: 'Выгрузка актов и счетов для клиентов', status: 'disconnected', lastSync: '-', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-100' },
];
