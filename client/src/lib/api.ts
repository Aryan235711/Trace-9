// API client with proper types
async function requestResponse(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  return fetch(url, {
    ...options,
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await requestResponse(url, options);

  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// Types
export interface UserTargets {
  id: string;
  userId: string;
  proteinTarget: number;
  gutTarget: number;
  sunTarget: number;
  exerciseTarget: number;
  sleepBaseline: number | null;
  rhrBaseline: number | null;
  hrvBaseline: number | null;
  isBaselineComplete: boolean;
  activeInterventionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyLog {
  id: string;
  userId: string;
  date: string;
  sleep: number;
  rhr: number;
  hrv: number;
  protein: number;
  gut: number;
  sun: number;
  exercise: number;
  symptomScore: number;
  symptomName: string | null;
  sleepFlag: string;
  rhrFlag: string;
  hrvFlag: string;
  proteinFlag: string;
  gutFlag: string;
  sunFlag: string;
  exerciseFlag: string;
  symptomFlag: string;
  createdAt: string;
}

export interface Intervention {
  id: string;
  userId: string;
  hypothesisText: string;
  startDate: string;
  endDate: string;
  result: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type InsightState = 'provisional' | 'locked' | 'action-required';

export interface InsightResponse {
  state: InsightState;
  message?: string;
  activeInterventionId?: string;
  mode?: 'negative' | 'positive' | 'stagnation' | null;
  hypothesis?: string | null;
  endDate?: string;
}

export interface CreateDailyLog {
  date: string;
  sleep: number;
  rhr: number;
  hrv: number;
  protein: number;
  gut: number;
  sun: number;
  exercise: number;
  symptomScore: number;
  symptomName?: string;
}

export interface UpdateUserTargets {
  proteinTarget?: number;
  gutTarget?: number;
  sunTarget?: number;
  exerciseTarget?: number;
}

export interface CreateIntervention {
  hypothesisText: string;
  startDate: string;
  endDate: string;
}

export type LogsPage = {
  logs: DailyLog[];
  nextCursor: string | null;
};

// API functions
export const api = {
  // Targets
  getTargets: async (): Promise<UserTargets> => {
    return request<UserTargets>("/api/targets");
  },
  
  updateTargets: async (data: UpdateUserTargets): Promise<UserTargets> => {
    return request<UserTargets>("/api/targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  
  // Logs
  getLogs: async (
    startDate?: string,
    endDate?: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<DailyLog[]> => {
    // If the caller explicitly requests a page (cursor/limit), do a single request.
    if (options?.cursor || options?.limit) {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.cursor) params.set('cursor', String(options.cursor));
      const query = params.toString();
      return request<DailyLog[]>(`/api/logs${query ? `?${query}` : ''}`);
    }

    // Default behavior: safely page through all logs using cursor headers.
    const all: DailyLog[] = [];
    const seen = new Set<string>();
    let cursor: string | null = null;
    const maxPages = 100; // safety cap

    for (let page = 0; page < maxPages; page += 1) {
      const { logs, nextCursor } = await api.getLogsPage(startDate, endDate, { limit: 1000, cursor: cursor ?? undefined });

      for (const log of logs) {
        // De-dupe defensively across pages.
        const key = `${log.date}:${log.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(log);
        }
      }

      if (!nextCursor) break;
      if (nextCursor === cursor) break;
      cursor = nextCursor;
    }

    return all;
  },

  // Logs (single page + cursor via response headers)
  getLogsPage: async (
    startDate?: string,
    endDate?: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<LogsPage> => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('limit', String(Math.min(Math.max(options?.limit ?? 1000, 1), 1000)));
    if (options?.cursor) params.set('cursor', String(options.cursor));

    const query = params.toString();
    const res = await requestResponse(`/api/logs${query ? `?${query}` : ''}`);
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }

    const logs = (await res.json()) as DailyLog[];
    const nextCursor = res.headers.get('X-Next-Cursor');
    return { logs, nextCursor: nextCursor ? String(nextCursor) : null };
  },
  
  getLog: async (date: string): Promise<DailyLog> => {
    return request<DailyLog>(`/api/logs/${date}`);
  },
  
  createLog: async (data: CreateDailyLog): Promise<DailyLog> => {
    return request<DailyLog>("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  
  updateLog: async (date: string, data: Partial<CreateDailyLog>): Promise<DailyLog> => {
    return request<DailyLog>(`/api/logs/${date}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  
  deleteLog: async (date: string): Promise<void> => {
    return request<void>(`/api/logs/${date}`, {
      method: "DELETE",
    });
  },
  
  // Interventions
  getInterventions: async (): Promise<Intervention[]> => {
    return request<Intervention[]>("/api/interventions");
  },
  
  getActiveIntervention: async (): Promise<Intervention | null> => {
    return request<Intervention | null>("/api/interventions/active");
  },
  
  createIntervention: async (data: CreateIntervention): Promise<Intervention> => {
    return request<Intervention>("/api/interventions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },
  
  updateIntervention: async (
    id: string, 
    data: Partial<CreateIntervention> & { result?: string; completedAt?: string }
  ): Promise<Intervention> => {
    return request<Intervention>(`/api/interventions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  checkInIntervention: async (id: string, result: 'Yes' | 'No' | 'Partial'): Promise<Intervention> => {
    return request<Intervention>(`/api/interventions/${id}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result }),
    });
  },

  // Insights
  getInsights: async (): Promise<InsightResponse> => {
    return request<InsightResponse>("/api/insights");
  },
};
