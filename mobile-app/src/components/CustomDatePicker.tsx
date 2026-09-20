import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface CustomDatePickerProps {
  value: string | undefined; // ISO string 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  mode?: 'date' | 'time';
}

export default function CustomDatePicker({ value, onChange, label, placeholder, mode = 'date' }: CustomDatePickerProps) {
  const [show, setShow] = useState(false);

  // Parse string to Date, default to now
  let parsedDate = new Date();
  if (value) {
    if (mode === 'time') {
      // For time string "HH:mm" or "HH:mm:ss"
      const parts = value.split(':');
      if (parts.length >= 2) {
        parsedDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      }
    } else {
      // For date string "YYYY-MM-DD"
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        parsedDate = parsed;
      }
    }
  }

  const handleConfirm = (event: any, selectedDate?: Date) => {
    // Hide picker for Android immediately
    if (Platform.OS === 'android') {
      setShow(false);
    }
    
    // Only process if user didn't cancel
    if (event.type === 'set' && selectedDate) {
      if (mode === 'date') {
        // Adjust for local timezone to avoid date shifting
        const dateStr = new Date(selectedDate.getTime() - (selectedDate.getTimezoneOffset() * 60000))
          .toISOString()
          .split('T')[0];
        onChange(dateStr);
      } else {
        const timeStr = selectedDate.toTimeString().split(' ')[0].substring(0, 5); // HH:mm
        onChange(timeStr);
      }
    } else if (event.type === 'dismissed' && Platform.OS === 'ios') {
       setShow(false);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity 
        style={styles.inputBox} 
        onPress={() => setShow(true)}
        activeOpacity={0.7}
      >
        <Text style={{ color: value ? '#1f2937' : '#9ca3af', fontSize: 15 }}>
          {value || placeholder || (mode === 'date' ? 'YYYY-MM-DD' : 'HH:mm')}
        </Text>
      </TouchableOpacity>
      
      {show && (
        <DateTimePicker
          value={parsedDate}
          mode={mode}
          display="default"
          onChange={handleConfirm}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    marginBottom: 0,
    marginTop: 12,
  },
  label: { 
    fontSize: 13, 
    color: '#4b5563', 
    fontWeight: 'bold', 
    marginBottom: 6 
  },
  inputBox: { 
    backgroundColor: '#f9fafb', 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    borderRadius: 8, 
    paddingHorizontal: 12, 
    paddingVertical: 14 
  }
});
