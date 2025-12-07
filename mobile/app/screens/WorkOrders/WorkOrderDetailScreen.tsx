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
import { Screen, Card, PrimaryButton, StatusPill, IconButton } from '../../components';
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

export const WorkOrderDetailScreen: React.FC = () => {
  const route = useRoute<WorkOrderDetailRouteParams>();
  const navigation = useNavigation<WorkOrderDetailNavigation>();
  const workOrderId = route.params.workOrderId;
  const { data: workOrder, isLoading, isError, refetch } = useWorkOrder(workOrderId);
  const updateStatus = useUpdateWorkOrderStatus();
  const updateTasks = useUpdateWorkOrderTasks();
  const { isOffline } = useNetworkBanner();
  const [notes, setNotes] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (workOrder?.description !== undefined && workOrder?.description !== null) {
      setNotes(workOrder.description);
    } else if (workOrder) {
      setNotes('');
    }
  }, [workOrder]);

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
          {workOrder.device_name ? ` • ${workOrder.device_name}` : ''}
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
});
