import type { Employee } from '../entities';

export interface EmployeeRepositoryPort {
  getAll(): Employee[];
}
