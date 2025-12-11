import { api } from "./httpClient";

export type OrgSummary = {
  id: string;
  name: string;
  siteCount?: number;
};

export async function fetchOrgs(): Promise<OrgSummary[]> {
  const res = await api.get<OrgSummary[]>("/orgs");
  return res.data;
}
