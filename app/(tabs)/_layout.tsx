import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#000000',
        tabBarInactiveTintColor: '#555555',
        headerShown: false,
        tabBarButton: HapticTab,
        // MODIFIED: Temporarily comment out TabBarBackground to isolate the issue
        // tabBarBackground: TabBarBackground, 
        tabBarStyle: Platform.select({
          ios: {
            // MODIFIED: Remove position: 'absolute' and set solid background color
            // position: 'absolute', 
            backgroundColor: '#f0e4d3',
          },
          default: {
            // MODIFIED: Set solid background color
            backgroundColor: '#f0e4d3',
          },
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'house.fill' : 'house'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'photo.fill.on.rectangle.fill' : 'photo.on.rectangle'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="collage"
        options={{
          title: 'Collage',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'square.grid.3x3.fill' : 'square.grid.3x3'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'calendar' : 'calendar.badge.clock'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stylist"
        options={{
          title: 'Stylist',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={28} name={focused ? 'wand.and.stars' : 'wand.and.stars.inverse'} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
