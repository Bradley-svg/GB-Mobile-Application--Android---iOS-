import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  useUpdateWorkOrderStatus,
  useUpdateWorkOrderTasks,
  useWorkOrder,
} from '../../api/hooks';
import type { WorkOrderStatus, WorkOrderTask } from '../../api/workOrders/types';
import { Screen, Card, PrimaryButton, StatusPill, IconButton, PillTabGroup } from '../../components';
import { AppStackParamList } from '../../navigation/RootNavigator';
import { useNetworkBanner } from '../../hooks/useNetworkBanner';
import { colors, gradients } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

type WorkOrderDetailRouteParams = RouteProp<AppStackParamList, 'WorkOrderDetail'>;
type WorkOrderDetailNavigation = NativeStackNavigationProp<AppStackParamList, 'WorkOrderDetail'>;

const statusDisplay = (status: WorkOrderStatus) => {
  switch (status) {
    case 'open':
      return { label: 'Open', tone: 'warning' as const };
    case 'in_progress':
      return { label: 'In progress', tone: 'warning' as const };
    case 'done':
      return { label: 'Done', tone: 'success' as const };
    case 'cancelled':
    default:
      return { label: 'Cancelled', tone: 'muted' as const };
  }
};

const parseDate = (value?: string | null) => (value ? new Date(value) : null);

const formatDuration = (ms: number) => {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const formatSlaDueLabel = (dueAt: Date | null) => {
  if (!dueAt) return 'No SLA target set for this work order.';
  const now = new Date();
  const time = dueAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (dueAt.toDateString() === now.toDateString()) return `Due today ${time}`;
  if (dueAt.toDateString() === tomorrow.toDateString()) return `Due tomorrow ${time}`;
  return `Due ${dueAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
};

const reminderPresetFromDates = (
  slaDueAt: Date | null,
  reminderAt: Date | null
): 'none' | 'hour' | 'day' => {
  if (!slaDueAt || !reminderAt) return 'none';
  const diffMs = Math.abs(slaDueAt.getTime() - reminderAt.getTime());
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;
  if (Math.abs(diffMs - hourMs) < 5 * 60 * 1000) return 'hour';
  if (Math.abs(diffMs - dayMs) < 30 * 60 * 1000) return 'day';
  return 'none';
};

export const WorkOrderDetailScreen: React.FC = () => {
  const route = useRoute<WorkOrderDetailRouteParams>();
  const navigation = useNavigation<WorkOrderDetailNavigation>();
  const workOrderId = route.params.workOrderId;
  const { data: workOrder, isLoading, isError, refetch } = useWorkOrder(workOrderId);
  const updateStatus = useUpdateWorkOrderStatus();
  const updateSla = useUpdateWorkOrderStatus();
  const updateTasks = useUpdateWorkOrderTasks();
  const { isOffline } = useNetworkBanner();
  const [notes, setNotes] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditingSla, setIsEditingSla] = useState(false);
  const [editedSlaDueAt, setEditedSlaDueAt] = useState<Date | null>(null);
  const [reminderPreset, setReminderPreset] = useState<'none' | 'hour' | 'day'>('none');

  useEffect(() => {
    if (workOrder?.description !== undefined && workOrder?.description !== null) {
      setNotes(workOrder.description);
    } else if (workOrder) {
      setNotes('');
    }
  }, [workOrder]);

  useEffect(() => {
    if (!workOrder || isEditingSla) return;
    const currentSla = parseDate(workOrder.slaDueAt ?? workOrder.sla_due_at ?? null);
    const reminderAt = parseDate(workOrder.reminderAt ?? workOrder.reminder_at ?? null);
    setEditedSlaDueAt(currentSla);
    setReminderPreset(reminderPresetFromDates(currentSla, reminderAt));
  }, [isEditingSla, workOrder]);

  const statusInfo = useMemo(() => (workOrder ? statusDisplay(workOrder.status) : null), [workOrder]);

  const onChangeStatus = async (next: WorkOrderStatus) => {
    if (!workOrder) return;
    if (isOffline) {
      setActionError('Read-only while offline.');
      return;
    }
    setActionError(null);
    try {
      await updateStatus.mutateAsync({ workOrderId, status: next });
    } catch (err) {
      console.error('Failed to update work order status', err);
      setActionError('Could not update status. Please try again.');
    }
  };

  const onSaveNotes = async () => {
    if (!workOrder) return;
    if (isOffline) {
      setActionError('Read-only while offline.');
      return;
    }
    try {
      await updateStatus.mutateAsync({ workOrderId, description: notes });
      setActionError(null);
    } catch (err) {
      console.error('Failed to update notes', err);
      setActionError('Could not save notes. Please try again.');
    }
  };

  const onToggleTask = async (task: WorkOrderTask) => {
    if (!workOrder) return;
    if (isOffline) {
      setActionError('Read-only while offline.');
      return;
    }
    try {
      const nextTasks = workOrder.tasks.map((t) =>
        t.id === task.id ? { ...t, is_completed: !t.is_completed } : t
      );
      await updateTasks.mutateAsync({
        workOrderId,
        tasks: nextTasks.map(({ label, is_completed, position }) => ({
          label,
          is_completed,
          position,
        })),
      });
      setActionError(null);
    } catch (err) {
      console.error('Failed to update tasks', err);
      setActionError('Could not update checklist. Please try again.');
    }
  };

  const onOpenSlaEdit = () => {
    if (!workOrder) return;
    if (isOffline) {
      setActionError('SLA changes require a connection');
      return;
    }
    const currentSla = parseDate(workOrder.slaDueAt ?? workOrder.sla_due_at ?? null);
    const reminderAt = parseDate(workOrder.reminderAt ?? workOrder.reminder_at ?? null);
    setEditedSlaDueAt(currentSla ?? new Date());
    setReminderPreset(reminderPresetFromDates(currentSla, reminderAt));
    setIsEditingSla(true);
    setActionError(null);
  };

  const onSaveSla = async () => {
    if (!workOrder) return;
    if (isOffline) {
      setActionError('SLA changes require a connection');
      return;
    }
    try {
      const reminderAt =
        reminderPreset === 'hour' && editedSlaDueAt
          ? new Date(editedSlaDueAt.getTime() - 60 * 60 * 1000)
          : reminderPreset === 'day' && editedSlaDueAt
          ? new Date(editedSlaDueAt.getTime() - 24 * 60 * 60 * 1000)
          : null;

      await updateSla.mutateAsync({
        workOrderId,
        slaDueAt: editedSlaDueAt ? editedSlaDueAt.toISOString() : null,
        reminderAt: reminderAt ? reminderAt.toISOString() : null,
      });
      setIsEditingSla(false);
    } catch (err) {
      console.error('Failed to update SLA', err);
      setActionError('Could not update SLA. Please try again.');
    }
  };

  const renderStatusActions = () => {
    if (!workOrder) return null;
    if (workOrder.status === 'done' || workOrder.status === 'cancelled') {
      return (
        <Text style={[typography.caption, styles.muted]}>
          Work order closed. Status changes are disabled.
        </Text>
      );
    }

    if (workOrder.status === 'open') {
      return (
        <View style={styles.actionRow}>
          <PrimaryButton
            label={updateStatus.isPending ? 'Starting...' : 'Start work'}
            onPress={() => onChangeStatus('in_progress')}
            disabled={updateStatus.isPending || isOffline}
            testID="start-work-button"
          />
          <PrimaryButton
            label="Cancel"
            onPress={() => onChangeStatus('cancelled')}
            variant="outline"
            disabled={updateStatus.isPending || isOffline}
            style={{ marginTop: spacing.sm }}
            testID="cancel-workorder-button"
          />
        </View>
      );
    }

    return (
      <View style={styles.actionRow}>
        <PrimaryButton
          label={updateStatus.isPending ? 'Marking...' : 'Mark as done'}
          onPress={() => onChangeStatus('done')}
          disabled={updateStatus.isPending || isOffline}
          testID="complete-workorder-button"
        />
        <PrimaryButton
          label="Cancel"
          onPress={() => onChangeStatus('cancelled')}
          variant="outline"
          disabled={updateStatus.isPending || isOffline}
          style={{ marginTop: spacing.sm }}
          testID="cancel-workorder-button"
        />
      </View>
    );
  };

  if (isLoading || !workOrder) {
    if (isError) {
      return (
        <Screen scroll={false} contentContainerStyle={styles.center} testID="WorkOrderDetailScreen">
          <Text style={[typography.body, styles.title]}>Failed to load work order</Text>
          <PrimaryButton label="Retry" onPress={() => refetch()} />
        </Screen>
      );
    }
    return (
      <Screen scroll={false} contentContainerStyle={styles.center} testID="WorkOrderDetailScreen">
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={[typography.body, styles.muted, { marginTop: spacing.sm }]}>Loading work order...</Text>
      </Screen>
    );
  }

  const linkedAlert = workOrder.alert_id
    ? { id: workOrder.alert_id, severity: workOrder.alert_severity }
    : null;
  const now = new Date();
  const slaDueAt = parseDate(workOrder.slaDueAt ?? workOrder.sla_due_at ?? null);
  const resolvedAt = parseDate(workOrder.resolvedAt ?? workOrder.resolved_at ?? null);
  const reminderAt = parseDate(workOrder.reminderAt ?? workOrder.reminder_at ?? null);
  const slaBreached = workOrder.slaBreached ?? workOrder.sla_breached ?? false;
  const overdue = slaDueAt ? now.getTime() > slaDueAt.getTime() && workOrder.status !== 'done' : false;
  const completedLate = workOrder.status === 'done' && slaBreached && slaDueAt && resolvedAt;

  return (
    <Screen scroll contentContainerStyle={{ paddingBottom: spacing.xxl }} testID="WorkOrderDetailScreen">
      <View style={styles.topBar}>
        <IconButton
          icon={<Ionicons name="chevron-back" size={20} color={colors.brandGrey} />}
          onPress={() => navigation.goBack()}
          testID="workorder-back-button"
        />
        {isOffline ? (
          <StatusPill label="Offline (read-only)" tone="muted" style={{ marginLeft: spacing.sm }} />
        ) : null}
      </View>

      <Card style={styles.headerCard}>
        <View style={styles.headerRow}>
          {statusInfo ? <StatusPill label={statusInfo.label} tone={statusInfo.tone} /> : null}
          {workOrder.priority ? (
            <Text style={[typography.caption, styles.priority]}>{workOrder.priority.toUpperCase()}</Text>
          ) : null}
        </View>
        <Text style={[typography.title2, styles.title, { marginBottom: spacing.xs }]} numberOfLines={2}>
          {workOrder.title}
        </Text>
        <Text style={[typography.caption, styles.muted]} numberOfLines={2}>
          {workOrder.site_name || 'Unknown site'}
          {workOrder.device_name ? ` > ${workOrder.device_name}` : ''}
        </Text>
        {linkedAlert ? (
          <TouchableOpacity
            style={styles.alertChip}
            onPress={() => navigation.navigate('AlertDetail', { alertId: linkedAlert.id })}
            disabled={isOffline}
            testID="linked-alert-chip"
          >
            <Ionicons
              name="alert-circle"
              size={14}
              color={linkedAlert.severity === 'critical' ? colors.error : gradients.brandPrimary.start}
            />
            <Text style={[typography.caption, styles.title, { marginLeft: spacing.xs }]}>
              Linked alert
            </Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      <Card style={styles.detailCard}>
        <View style={styles.slaHeader}>
          <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.xs }]}>SLA</Text>
          <TouchableOpacity
            style={styles.slaEditButton}
            onPress={onOpenSlaEdit}
            disabled={isOffline}
            testID="edit-sla-button"
          >
            <Ionicons name="time-outline" size={16} color={colors.brandGreen} />
            <Text style={[typography.caption, styles.title, { marginLeft: spacing.xs }]}>
              {isEditingSla ? 'Close' : 'Edit SLA'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text
          style={[
            typography.body,
            workOrder.status === 'done'
              ? slaBreached
                ? styles.warningText
                : styles.title
              : overdue
              ? styles.errorText
              : styles.title,
          ]}
        >
          {!slaDueAt
            ? 'No SLA target set for this work order.'
            : workOrder.status === 'done'
            ? slaBreached && completedLate
              ? `Completed ${formatDuration(resolvedAt!.getTime() - slaDueAt.getTime())} after SLA`
              : 'Completed in SLA'
            : overdue
            ? `Overdue by ${formatDuration(now.getTime() - slaDueAt.getTime())}`
            : formatSlaDueLabel(slaDueAt)}
        </Text>
        <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
          {reminderAt ? `Reminder set for ${reminderAt.toLocaleString()}` : 'No reminder scheduled.'}
        </Text>
        {isEditingSla ? (
          <>
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
              Quick set
            </Text>
            <View style={styles.slaQuickRow}>
              <TouchableOpacity
                style={styles.slaQuickButton}
                onPress={() => setEditedSlaDueAt(new Date(Date.now() + 4 * 60 * 60 * 1000))}
              >
                <Text style={[typography.caption, styles.title]}>In 4 hours</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.slaQuickButton}
                onPress={() => setEditedSlaDueAt(new Date(Date.now() + 24 * 60 * 60 * 1000))}
              >
                <Text style={[typography.caption, styles.title]}>Tomorrow</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.slaQuickButton}
                onPress={() => setEditedSlaDueAt(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))}
              >
                <Text style={[typography.caption, styles.title]}>+3 days</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.slaQuickButton} onPress={() => setEditedSlaDueAt(null)}>
                <Text style={[typography.caption, styles.muted]}>Clear</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.slaInput, { marginTop: spacing.sm }]}
              placeholder="YYYY-MM-DDTHH:MM (local)"
              value={editedSlaDueAt ? editedSlaDueAt.toISOString().slice(0, 16) : ''}
              onChangeText={(value) => {
                if (!value) {
                  setEditedSlaDueAt(null);
                  return;
                }
                const parsed = new Date(value);
                setEditedSlaDueAt(Number.isNaN(parsed.getTime()) ? null : parsed);
              }}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
              testID="sla-due-input"
            />
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
              Reminder
            </Text>
            <PillTabGroup
              value={reminderPreset}
              options={[
                { value: 'none', label: 'None' },
                { value: 'hour', label: '1h before' },
                { value: 'day', label: '1 day before' },
              ]}
              onChange={(value) => setReminderPreset(value as 'none' | 'hour' | 'day')}
            />
            <Text style={[typography.caption, styles.muted, { marginTop: spacing.sm }]}>
              {editedSlaDueAt
                ? `Selected: ${formatSlaDueLabel(editedSlaDueAt)}`
                : 'SLA target will be cleared.'}
            </Text>
            <View style={[styles.actionRow, { marginTop: spacing.sm }]}>
              <PrimaryButton
                label={updateSla.isPending ? 'Saving...' : 'Save SLA'}
                onPress={onSaveSla}
                disabled={updateSla.isPending || isOffline}
                testID="save-sla-button"
              />
              <PrimaryButton
                label="Cancel"
                onPress={() => {
                  setIsEditingSla(false);
                  setEditedSlaDueAt(slaDueAt ?? null);
                  setReminderPreset(reminderPresetFromDates(slaDueAt, reminderAt));
                }}
                variant="outline"
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </>
        ) : null}
        {isOffline ? (
          <Text style={[typography.caption, styles.muted, { marginTop: spacing.xs }]}>
            SLA changes require a connection
          </Text>
        ) : null}
      </Card>

      <Card style={styles.detailCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Checklist</Text>
        {workOrder.tasks.length === 0 ? (
          <Text style={[typography.caption, styles.muted]}>No tasks yet.</Text>
        ) : (
          workOrder.tasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskRow}
              onPress={() => onToggleTask(task)}
              disabled={isOffline || updateTasks.isPending}
              testID={`task-${task.id}`}
            >
              <Ionicons
                name={task.is_completed ? 'checkbox' : 'square-outline'}
                size={20}
                color={task.is_completed ? colors.brandGreen : colors.textSecondary}
              />
              <Text
                style={[
                  typography.body,
                  styles.title,
                  { marginLeft: spacing.sm, textDecorationLine: task.is_completed ? 'line-through' : 'none' },
                ]}
              >
                {task.label}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </Card>

      <Card style={styles.detailCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.xs }]}>Notes</Text>
        <TextInput
          style={styles.notesInput}
          multiline
          placeholder="Add notes, observations, and readings..."
          value={notes}
          onChangeText={setNotes}
          editable={!isOffline}
          testID="workorder-notes-input"
        />
        <PrimaryButton
          label={updateStatus.isPending ? 'Saving...' : 'Save notes'}
          onPress={onSaveNotes}
          disabled={updateStatus.isPending || isOffline}
          variant="outline"
          style={{ marginTop: spacing.sm }}
          testID="save-notes-button"
        />
      </Card>

      <Card style={styles.detailCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Details</Text>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Created</Text>
          <Text style={[typography.body, styles.title]}>
            {new Date(workOrder.created_at).toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[typography.caption, styles.muted]}>Due</Text>
          <Text style={[typography.body, styles.title]}>
            {workOrder.due_at ? new Date(workOrder.due_at).toLocaleString() : 'Not set'}
          </Text>
        </View>
      </Card>

      <Card style={styles.detailCard}>
        <Text style={[typography.subtitle, styles.title, { marginBottom: spacing.sm }]}>Status</Text>
        {renderStatusActions()}
        {actionError ? <Text style={[typography.caption, styles.errorText]}>{actionError}</Text> : null}
        {isOffline ? (
          <Text style={[typography.caption, styles.muted]}>
            Read-only while offline. Reconnect to update status or checklist.
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.textPrimary },
  muted: { color: colors.textSecondary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  headerCard: {
    marginBottom: spacing.md,
  },
  slaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slaEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
  },
  slaQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  slaQuickButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.backgroundAlt,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  priority: {
    color: colors.brandGrey,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 14,
    backgroundColor: colors.backgroundAlt,
    marginTop: spacing.sm,
  },
  detailCard: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  actionRow: {
    gap: spacing.sm,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  slaInput: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundAlt,
  },
  notesInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 12,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundAlt,
    textAlignVertical: 'top',
  },
  errorText: { color: colors.error, marginTop: spacing.sm },
  warningText: { color: colors.warning },
});
