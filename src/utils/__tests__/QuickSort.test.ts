/**
 * 快速排序单元测试
 */

import { quickSort, quickSortDesc, quickSortInPlaceWrapper } from './QuickSort';

describe('QuickSort', () => {
  describe('quickSort - 基本功能', () => {
    it('应该正确排序空数组', () => {
      expect(quickSort([])).toEqual([]);
    });

    it('应该正确排序单元素数组', () => {
      expect(quickSort([1])).toEqual([1]);
    });

    it('应该正确排序已排序数组', () => {
      expect(quickSort([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    });

    it('应该正确排序逆序数组', () => {
      expect(quickSort([5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4, 5]);
    });

    it('应该正确排序随机数组', () => {
      expect(quickSort([3, 1, 4, 1, 5, 9, 2, 6, 5, 3]))
        .toEqual([1, 1, 2, 3, 3, 4, 5, 5, 6, 9]);
    });

    it('应该正确处理重复元素', () => {
      expect(quickSort([5, 5, 5, 5])).toEqual([5, 5, 5, 5]);
    });

    it('应该正确处理负数', () => {
      expect(quickSort([-3, 1, -4, 1, 5])).toEqual([-4, -3, 1, 1, 5]);
    });
  });

  describe('quickSort - 自定义比较函数', () => {
    it('应该支持自定义降序比较', () => {
      const result = quickSort([1, 2, 3], (a, b) => b - a);
      expect(result).toEqual([3, 2, 1]);
    });

    it('应该支持对象数组排序', () => {
      const users = [
        { name: 'Bob', age: 25 },
        { name: 'Alice', age: 30 },
        { name: 'Charlie', age: 20 },
      ];
      const result = quickSort(users, (a, b) => a.age - b.age);
      expect(result).toEqual([
        { name: 'Charlie', age: 20 },
        { name: 'Bob', age: 25 },
        { name: 'Alice', age: 30 },
      ]);
    });

    it('应该支持字符串数组排序', () => {
      expect(quickSort(['banana', 'apple', 'cherry'])).toEqual(['apple', 'banana', 'cherry']);
    });
  });

  describe('quickSort - 不修改原数组', () => {
    it('应该返回新数组而不修改原数组', () => {
      const original = [3, 1, 2];
      const sorted = quickSort(original);
      expect(original).toEqual([3, 1, 2]);
      expect(sorted).toEqual([1, 2, 3]);
    });
  });

  describe('quickSortDesc - 降序排序', () => {
    it('应该正确降序排序数字数组', () => {
      expect(quickSortDesc([1, 2, 3, 4, 5])).toEqual([5, 4, 3, 2, 1]);
    });

    it('应该正确处理空数组和单元素数组', () => {
      expect(quickSortDesc([])).toEqual([]);
      expect(quickSortDesc([1])).toEqual([1]);
    });
  });

  describe('quickSortInPlaceWrapper - 原地排序', () => {
    it('应该在原数组上进行排序', () => {
      const arr = [3, 1, 4, 1, 5];
      const result = quickSortInPlaceWrapper(arr);
      expect(arr).toEqual([1, 1, 3, 4, 5]);
      expect(result).toBe(arr); // 返回同一引用
    });
  });

  describe('性能测试', () => {
    it('应该能处理较大数组', () => {
      const largeArray = Array.from({ length: 1000 }, () => Math.random());
      const sorted = quickSort(largeArray);
      
      // 验证排序正确性
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
      }
    });
  });
});