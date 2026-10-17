// src/components/TimeZoneSelect.tsx
import { useMemo } from 'react';
import { browserTimeZone, supportedTimeZones, timeZoneCity } from '@/domain/zonedTime';
import { SelectField } from './Field';

/**
 * Every IANA zone the platform knows, with the current value and this
 * device's zone pinned to the top — the two a student almost always wants, out
 * of a list of four hundred.
 */
export default function TimeZoneSelect({
  value,
  onChange,
  label = 'Time zone',
  hint,
  error,
  disabled,
}: {
  value: string;
  onChange: (zone: string) => void;
  label?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const options = useMemo(() => {
    const device = browserTimeZone();
    const ordered = [value, device, ...supportedTimeZones()].filter(Boolean);
    return [...new Set(ordered)].map((zone) => ({
      value: zone,
      label: `${timeZoneCity(zone)} (${zone})${zone === device ? ' · this device' : ''}`,
    }));
  }, [value]);

  return (
    <SelectField
      label={label}
      hint={hint}
      error={error}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={options}
    />
  );
}
