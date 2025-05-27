
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  token?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  filter?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
