/**
 * Conflict Detection Configuration
 * Các ngưỡng và thông số cho thuật toán phát hiện xung đột
 */
module.exports = {
  // Pairwise 4D Trajectory Conflict Detection
  pairwise: {
    D_MIN: 100, // Khoảng cách ngang tối thiểu (m)
    H_MIN: 30, // Khoảng cách đứng tối thiểu (m)
    TIME_STEP: 30, // Bước thời gian kiểm tra (s)
  },

  // Airspace Segmentation-based Conflict Detection
  segmentation: {
    CELL_SIZE_X: 200, // Chiều ngang cell (m)
    CELL_SIZE_Y: 200, // Chiều dọc cell (m)
    CELL_SIZE_Z: 50, // Chiều cao cell (m)
    TIME_SLOT: 60, // Khoảng thời gian slot (s)
  },

  // Severity thresholds
  severity: {
    CRITICAL_DISTANCE: 30, // < 30m → CRITICAL
    HIGH_DISTANCE: 60, // < 60m → HIGH
    MEDIUM_DISTANCE: 100, // < 100m → MEDIUM
    // >= 100m → LOW (nếu vẫn trong vùng cảnh báo)
  },
};
