import path from 'path';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.FILE_STORAGE_ROOT =
  process.env.FILE_STORAGE_ROOT || path.resolve(__dirname, '../uploads-test');
