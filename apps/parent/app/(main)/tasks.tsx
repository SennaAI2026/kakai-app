import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { supabase } from '@kakai/api';
import { t } from '@kakai/i18n';
import { DEFAULT_REWARD_MINUTES } from '@kakai/shared';
import type { Task, User } from '@kakai/shared';

type ExtTask = Task & { approved_at?: string | null; users?: { name: string } | null };

type FilterKey = 'all' | 'pending' | 'done' | 'approved' | 'rejected';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',      label: 'Все' },
  { key: 'done',     label: '⏳ Ждут' },
  { key: 'pending',  label: '📋 Активные' },
  { key: 'approved', label: '✅ Выполнено' },
  { key: 'rejected', label: '❌ Отклонено' },
];

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Активное',      color: '#92400E', bg: '#FEF3C7' },
  done:     { label: 'Ждёт проверки', color: '#1D4ED8', bg: '#EFF6FF' },
  approved: { label: 'Выполнено',     color: '#065F46', bg: '#D1FAE5' },
  rejected: { label: 'Отклонено',     color: '#991B1B', bg: '#FEE2E2' },
};

const REWARD_PRESETS = [10, 15, 30, 60];

const AVATARS = ['🦊', '🐻', '🐼', '🐨'];

export default function TasksScreen() {
  const [tasks, setTasks] = useState<ExtTask[]>([]);
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(String(DEFAULT_REWARD_MINUTES));
  const [loading, setLoading] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: userData } = await supabase
      .from('users').select('family_id').eq('id', authUser.id).maybeSingle();
    if (!userData?.family_id) return;

    setFamilyId(userData.family_id);

    const [{ data: childrenData }, { data: tasksData }] = await Promise.all([
      supabase.from('users').select('*').eq('family_id', userData.family_id).eq('role', 'child'),
      supabase
        .from('tasks')
        .select('*, users(name)')
        .eq('family_id', userData.family_id)
        .order('created_at', { ascending: false }),
    ]);

    if (childrenData?.length) {
      const kids = childrenData as User[];
      setChildren(kids);
      setSelectedChildId((prev) => prev ?? kids[0].id);
    }
    if (tasksData) setTasks(tasksData as unknown as ExtTask[]);
  }, []);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel('parent-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  function openModal() {
    setTitle('');
    setMinutes(String(DEFAULT_REWARD_MINUTES));
    setShowModal(true);
  }

  async function handleCreate() {
    if (!title.trim()) {
      Alert.alert(t('common.error'), 'Введите название задания');
      return;
    }
    if (!selectedChildId) {
      Alert.alert(t('common.error'), t('parent.home.noChildrenDesc'));
      return;
    }
    if (!familyId) return;

    setLoading(true);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { setLoading(false); return; }

    const { error } = await supabase.from('tasks').insert({
      family_id: familyId,
      child_id: selectedChildId,
      created_by: authUser.id,
      title: title.trim(),
      reward_minutes: Math.max(1, parseInt(minutes) || DEFAULT_REWARD_MINUTES),
      status: 'pending',
    });

    if (error) {
      Alert.alert(t('common.error'), error.message);
    } else {
      setShowModal(false);
      loadAll();
    }
    setLoading(false);
  }

  async function handleApprove(task: ExtTask) {
    const { data: timeData } = await supabase
      .from('screen_time')
      .select('id, balance_minutes')
      .eq('child_id', task.child_id)
      .maybeSingle();

    const current = (timeData as { id: string; balance_minutes: number } | null)?.balance_minutes ?? 0;

    const [{ error: taskErr }] = await Promise.all([
      supabase.from('tasks').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
      }).eq('id', task.id),
      timeData
        ? supabase.from('screen_time').update({ balance_minutes: current + task.reward_minutes }).eq('id', timeData.id)
        : Promise.resolve({ error: null }),
    ]);

    if (taskErr) Alert.alert(t('common.error'), taskErr.message);
    else {
      Alert.alert('🎉', `+${task.reward_minutes} ${t('common.minutes')} начислено!`);
      loadAll();
    }
  }

  async function handleReject(taskId: string) {
    Alert.alert('Отклонить задание?', 'Ребёнок увидит, что задание не засчитано.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Отклонить', style: 'destructive',
        onPress: async () => {
          await supabase.from('tasks').update({ status: 'rejected' }).eq('id', taskId);
          loadAll();
        },
      },
    ]);
  }

  async function handleDelete(taskId: string) {
    Alert.alert('Удалить задание?', 'Это действие нельзя отменить.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          await supabase.from('tasks').delete().eq('id', taskId);
          loadAll();
        },
      },
    ]);
  }

  const filtered = tasks.filter((tk) => filter === 'all' || tk.status === filter);
  const doneCount = tasks.filter((tk) => tk.status === 'done').length;

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>{t('parent.tasks.title')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openModal} activeOpacity={0.8}>
          <Text style={s.addBtnText}>＋ {t('parent.tasks.add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.filtersRow}
      >
        {FILTERS.map((f) => {
          const isActive = filter === f.key;
          const badge = f.key === 'done' && doneCount > 0 ? doneCount : 0;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterChip, isActive && s.filterChipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.filterChipText, isActive && s.filterChipTextActive]}>
                {f.label}
              </Text>
              {badge > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Tasks list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
          const childName = item.users?.name;
          return (
            <View style={[s.taskCard, item.status === 'done' && s.taskCardHighlight]}>
              <View style={s.taskHeader}>
                <Text style={s.taskTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>

              <View style={s.taskMeta}>
                <Text style={s.taskReward}>⏱ +{item.reward_minutes} {t('common.minutes')}</Text>
                {childName && (
                  <Text style={s.taskChild}>
                    {AVATARS[(children.find(c => c.id === item.child_id)?.avatar_index ?? 1) - 1]} {childName}
                  </Text>
                )}
              </View>

              {/* Action buttons for tasks waiting approval */}
              {item.status === 'done' && (
                <View style={s.actionRow}>
                  <TouchableOpacity
                    style={s.approveBtn}
                    onPress={() => handleApprove(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.approveBtnText}>✓ Одобрить</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.rejectBtn}
                    onPress={() => handleReject(item.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.rejectBtnText}>✕ Отклонить</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delete button for pending/rejected */}
              {(item.status === 'pending' || item.status === 'rejected') && (
                <TouchableOpacity
                  style={s.deleteLink}
                  onPress={() => handleDelete(item.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.deleteLinkText}>Удалить задание</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyEmoji}>
              {filter === 'done' ? '⏳' : filter === 'approved' ? '🏆' : '📋'}
            </Text>
            <Text style={s.emptyTitle}>
              {filter === 'done' ? 'Нет заданий на проверке' :
               filter === 'approved' ? 'Ещё нет выполненных заданий' :
               filter === 'rejected' ? 'Нет отклонённых заданий' :
               t('parent.tasks.empty')}
            </Text>
            {filter === 'all' || filter === 'pending' ? (
              <TouchableOpacity style={s.emptyAddBtn} onPress={openModal} activeOpacity={0.8}>
                <Text style={s.emptyAddBtnText}>+ Создать задание</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        contentContainerStyle={filtered.length === 0 ? s.emptyContainer : s.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Create task modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={s.overlayBg} activeOpacity={1} onPress={() => setShowModal(false)} />

          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Новое задание</Text>

            {/* Child selector */}
            {children.length > 1 && (
              <>
                <Text style={s.fieldLabel}>Для кого</Text>
                <View style={s.childRow}>
                  {children.map((child) => (
                    <TouchableOpacity
                      key={child.id}
                      style={[s.childBtn, selectedChildId === child.id && s.childBtnActive]}
                      onPress={() => setSelectedChildId(child.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.childBtnText, selectedChildId === child.id && s.childBtnTextActive]}>
                        {AVATARS[(child.avatar_index ?? 1) - 1]} {child.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={s.fieldLabel}>Название задания</Text>
            <TextInput
              style={s.input}
              placeholder="Например: Убраться в комнате"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="next"
            />

            <Text style={s.fieldLabel}>Награда (минут экранного времени)</Text>
            <View style={s.presetsRow}>
              {REWARD_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.presetBtn, minutes === String(p) && s.presetBtnActive]}
                  onPress={() => setMinutes(String(p))}
                  activeOpacity={0.8}
                >
                  <Text style={[s.presetBtnText, minutes === String(p) && s.presetBtnTextActive]}>
                    {p} мин
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[s.input, s.inputSmall]}
              placeholder="Или введите своё число"
              placeholderTextColor="#9CA3AF"
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
            />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.createBtn, loading && s.createBtnDisabled]}
                onPress={handleCreate}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={s.createBtnText}>
                  {loading ? t('common.loading') : '+ Создать'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF7' },

  // Header
  header: {
    paddingTop: 60, paddingHorizontal: 24, paddingBottom: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#0D1B12' },
  addBtn: {
    backgroundColor: '#0D1B12', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  addBtnText: { color: '#0FA968', fontWeight: '700', fontSize: 14 },

  // Filter chips
  filtersRow: { paddingHorizontal: 24, paddingBottom: 16, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'white', borderWidth: 1, borderColor: '#C8E8D5',
  },
  filterChipActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6B7B6E' },
  filterChipTextActive: { color: 'white' },
  badge: {
    backgroundColor: '#EF4444', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '800', color: 'white' },

  // Task cards
  listContent: { paddingBottom: 32 },
  taskCard: {
    backgroundColor: 'white', borderRadius: 16, padding: 16,
    marginHorizontal: 24, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  taskCardHighlight: { borderColor: '#3B82F6', backgroundColor: '#F0F7FF' },
  taskHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  taskTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0D1B12', lineHeight: 21 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: '700' },
  taskMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskReward: { fontSize: 13, color: '#0FA968', fontWeight: '700' },
  taskChild: { fontSize: 12, color: '#6B7B6E' },

  // Action row (for done tasks)
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  approveBtn: {
    flex: 1, backgroundColor: '#0FA968', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  approveBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  rejectBtn: {
    flex: 1, backgroundColor: '#FEE2E2', borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FCA5A5',
  },
  rejectBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 14 },

  // Delete link
  deleteLink: { marginTop: 10, alignSelf: 'flex-end' },
  deleteLinkText: { fontSize: 12, color: '#9CA3AF' },

  // Empty states
  emptyContainer: { flexGrow: 1 },
  emptyWrap: { alignItems: 'center', paddingVertical: 80 },
  emptyEmoji: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 15, color: '#6B7B6E', textAlign: 'center', marginBottom: 20 },
  emptyAddBtn: {
    backgroundColor: '#0FA968', borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  emptyAddBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },

  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#00000050' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 22, fontWeight: '800', color: '#0D1B12', marginBottom: 20 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#6B7B6E', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  input: {
    backgroundColor: '#F4FBF7', borderRadius: 12, padding: 14,
    fontSize: 15, color: '#0D1B12', marginBottom: 16,
    borderWidth: 1, borderColor: '#C8E8D5',
  },
  inputSmall: { marginBottom: 20 },

  presetsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  presetBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    backgroundColor: '#F4FBF7', borderWidth: 1, borderColor: '#C8E8D5',
  },
  presetBtnActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  presetBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7B6E' },
  presetBtnTextActive: { color: 'white' },

  childRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  childBtn: {
    borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#C8E8D5', backgroundColor: '#F4FBF7',
  },
  childBtnActive: { backgroundColor: '#0FA968', borderColor: '#0FA968' },
  childBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7B6E' },
  childBtnTextActive: { color: 'white' },

  modalBtns: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#C8E8D5',
  },
  cancelBtnText: { fontSize: 15, color: '#6B7B6E', fontWeight: '600' },
  createBtn: { flex: 2, backgroundColor: '#0FA968', borderRadius: 12, padding: 16, alignItems: 'center' },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
});
