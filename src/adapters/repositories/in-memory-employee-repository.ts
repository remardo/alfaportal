import type { Employee } from '../../domain/entities';
import type { EmployeeRepositoryPort } from '../../domain/ports/employee-repository';

export class InMemoryEmployeeRepository implements EmployeeRepositoryPort {
  constructor(private readonly employees: Employee[]) {}

  getAll(): Employee[] {
    return this.employees;
  }
}
