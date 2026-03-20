export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePassword = (password: string): { isValid: boolean; message: string } => {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number.' };
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character.' };
  }
  return { isValid: true, message: '' };
};

export const validatePhone = (phone: string): boolean => {
  if (!phone) return true; // Optional
  // Basic phone regex: + followed by digits, or just digits, common formats
  const re = /^(\+?\d{1,3}[- ]?)?\d{10}$/;
  return re.test(phone.replace(/[-() ]/g, ''));
};

export const validateFullName = (name: string): boolean => {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2;
};

export const validateAmount = (amount: string): boolean => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0;
};

export const validateRoutingNumber = (routing: string): boolean => {
  return /^\d{9}$/.test(routing);
};

export const validateAccountNumber = (account: string): boolean => {
  return /^\d{8,17}$/.test(account);
};
