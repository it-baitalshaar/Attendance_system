// Date formatting helpers
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const formatDisplayDate = (date: string): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Status helpers
export function getStatusColor(
  status: string,
  status_attendance: string
): string {
  if (status === 'present') {
    return 'bg-green-100 text-green-800';
  } else if (status === 'absent') {
    return 'bg-red-100 text-red-800';
  } else if (status_attendance === 'Sick Leave') {
    return 'bg-purple-100 text-purple-800';
  } else if (status_attendance === 'Holiday-Work') {
    return 'bg-blue-100 text-blue-800';
  } else if (status_attendance === 'Vacation') {
    return 'bg-yellow-100 text-yellow-800';
  } else {
    return 'bg-gray-100 text-gray-800';
  }
}

export function getStatusLabel(
  status: string,
  status_attendance: string
): string {
  if (status_attendance && status_attendance !== 'Present') {
    return status_attendance;
  }
  return status;
}

