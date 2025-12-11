import axios from "axios";
import { api } from "./httpClient";
import type { HeatPumpHistoryRequest, HeatPumpHistoryResponse, HeatPumpHistoryError } from "@/lib/types/history";

export async function fetchHeatPumpHistory(params: HeatPumpHistoryRequest): Promise<HeatPumpHistoryResponse> {
  try {
    const res = await api.post<HeatPumpHistoryResponse>("/heat-pump-history", {
      ...params,
      aggregation: params.aggregation ?? "raw",
      mode: params.mode ?? "live",
    });
    return res.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const message = (err.response?.data as { message?: string } | undefined)?.message || err.message;
      let kind: HeatPumpHistoryError["kind"] = "otherError";
      if (status === 503) kind = "circuitOpen";
      else if (status === 502) kind = "upstream";
      else if (status && status >= 500) kind = "unavailable";
      throw { status, message, kind } as HeatPumpHistoryError;
    }
    throw { message: "Unknown error", kind: "otherError" } as HeatPumpHistoryError;
  }
}
