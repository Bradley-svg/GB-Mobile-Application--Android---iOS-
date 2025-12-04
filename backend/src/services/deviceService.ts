import { getDeviceById as getDeviceByIdRepo } from '../repositories/devicesRepository';

export async function getDeviceById(id: string, organisationId?: string) {
  return getDeviceByIdRepo(id, organisationId);
}
