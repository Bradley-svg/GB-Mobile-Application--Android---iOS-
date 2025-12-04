import { getUserContextById } from '../repositories/usersRepository';

export type UserContext = {
  id: string;
  email?: string;
  name?: string;
  organisation_id: string | null;
};

export async function getUserContext(userId: string): Promise<UserContext | null> {
  return getUserContextById(userId);
}

export function requireOrganisationId(user: UserContext): string {
  if (!user.organisation_id) {
    throw new Error('USER_ORG_MISSING');
  }
  return user.organisation_id;
}
