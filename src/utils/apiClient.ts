import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define API response type
interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private static instance: ApiClient;

  private constructor() {
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: '/api', // Use relative URL for API routes in Next.js App Router
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        // Get token from localStorage in browser environment
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('authToken');
          if (token && config.headers) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error: AxiosError) => {
        // Handle authentication errors
        if (error.response?.status === 401) {
          // Clear token and redirect to login if unauthorized
          if (typeof window !== 'undefined') {
            localStorage.removeItem('authToken');
            window.location.href = '/auth/login';
          }
        }
        
        // Handle validation errors
        if (error.response?.status === 422) {
          console.error('Validation error:', error.response.data);
        }
        
        // Handle server errors
        if (error.response?.status === 500) {
          console.error('Server error:', error.response.data);
        }
        
        return Promise.reject(error);
      }
    );
  }

  // Singleton pattern to get instance
  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // Generic request method
  public async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data as T;
    } catch (error) {
      throw error;
    }
  }

  // GET method
  public async get<T = any>(url: string, params?: any): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  // POST method
  public async post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
    });
  }

  // PUT method
  public async put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
    });
  }

  // DELETE method
  public async delete<T = any>(url: string, params?: any): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url,
      params,
    });
  }

  // PATCH method
  public async patch<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
    });
  }
}

// Export singleton instance
const apiClient = ApiClient.getInstance();
export default apiClient;
