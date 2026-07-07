import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { APIResponseInterface, Pagination } from '../interfaces/response.interface';

export function ok<T>(
  message: string,
  data: T,
  pagination: Pagination | null = null,
): APIResponseInterface<T> {
  return {
    code: HttpStatus.OK,
    message,
    data,
    pagination: pagination ?? undefined,
  };
}

export function created<T>(message: string, data: T): APIResponseInterface<T> {
  return {
    code: HttpStatus.CREATED,
    message,
    data,
  };
}

export function paginated<T>(
  message: string,
  data: T,
  pagination: Pagination,
): APIResponseInterface<T> {
  return {
    code: HttpStatus.OK,
    message,
    data,
    pagination,
  };
}
