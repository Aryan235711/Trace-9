// API client with proper types
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      ...options?.headers,
    },
  });

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
  getLogs: async (startDate?: string, endDate?: string): Promise<DailyLog[]> => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const query = params.toString();
    return request<DailyLog[]>(`/api/logs${query ? `?${query}` : ""}`);
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
};
