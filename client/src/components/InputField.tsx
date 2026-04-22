import React from 'react';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
  suffix?: string;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  hint,
  error,
  prefix,
  suffix,
  className,
  id,
  ...rest
}) => {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="mb-4">
      <label htmlFor={fieldId} className="input-label">
        {label}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 font-medium select-none">{prefix}</span>
        )}
        <input
          id={fieldId}
          className={`input-field ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''} ${
            error ? 'border-red-500 focus:ring-red-400' : ''
          } ${className ?? ''}`}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 text-sm select-none">{suffix}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
};

export default InputField;
