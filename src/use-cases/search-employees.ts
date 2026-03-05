import type { Employee } from '../domain/entities';
import type { EmployeeRepositoryPort } from '../domain/ports/employee-repository';

export class SearchEmployeesUseCase {
  constructor(private readonly employeeRepository: EmployeeRepositoryPort) {}

  execute(query: string): Employee[] {
    const normalizedQuery = query.trim().toLowerCase();
    const employees = this.employeeRepository.getAll();

    if (!normalizedQuery) {
      return employees;
    }

    return employees.filter((employee) => {
      return (
        employee.name.toLowerCase().includes(normalizedQuery) ||
        employee.post.toLowerCase().includes(normalizedQuery)
      );
    });
  }
}
