import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Text, ActivityIndicator, TouchableOpacity, Platform, Image, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Calendar, DateData } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { AppColors } from '@/constants/Colors';
import OriginalCollagePreview from '@/components/CollagePreview';
import { NamedCollage, CanvasItem } from '@/types/collage';
import { Ionicons } from '@expo/vector-icons';

const NAMED_COLLAGES_STORAGE_KEY = '@StyleIt/NamedCollages';
const DATE_COLLAGE_ASSIGNMENTS_KEY = '@StyleIt/DateCollageAssignments';

interface DateAssignments {
  [dateString: string]: string;
}

// --- CustomDayComponent for the Calendar (Restored and Adapted) ---
interface CustomDayProps {
  date?: DateData;
  marking?: { selected?: boolean; assignedCollageId?: string; [key: string]: any };
  state?: 'selected' | 'disabled' | 'today' | string;
  onPress?: (date: DateData) => void;
  getCollageById: (id: string) => NamedCollage | undefined;
}

const CustomDayComponent: React.FC<CustomDayProps> = ({ date, marking, state, onPress, getCollageById }) => {
  const assignedCollage = marking?.assignedCollageId ? getCollageById(marking.assignedCollageId) : undefined;

  const renderMiniCollage = (collage: NamedCollage) => {
    if (!collage.items || collage.items.length === 0) {
      return null;
    }
    const previewSize = styles.dayMiniCollageImage.width; 
    const itemWidthOnCanvas = 120; 
    const itemHeightOnCanvas = 120;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    collage.items.forEach(item => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + itemWidthOnCanvas);
      maxY = Math.max(maxY, item.y + itemHeightOnCanvas);
    });
    if (collage.items.length === 0 || minX === Infinity) return null;
    if (collage.items.length === 1) {
        minX = collage.items[0].x; minY = collage.items[0].y;
        maxX = collage.items[0].x + itemWidthOnCanvas; maxY = collage.items[0].y + itemHeightOnCanvas;
    }
    const originalContentWidth = Math.max(1, maxX - minX);
    const originalContentHeight = Math.max(1, maxY - minY);
    const scaleX = previewSize / originalContentWidth;
    const scaleY = previewSize / originalContentHeight;
    const scale = Math.min(scaleX, scaleY);
    return (
      <View style={styles.dayMiniCollageImage}>
        {collage.items.map((item) => {
          const scaledItemX = (item.x - minX) * scale;
          const scaledItemY = (item.y - minY) * scale;
          const scaledItemWidth = itemWidthOnCanvas * scale;
          const scaledItemHeight = itemHeightOnCanvas * scale;
          if (scaledItemX >= previewSize || scaledItemY >= previewSize || 
              scaledItemX + scaledItemWidth <= 0 || scaledItemY + scaledItemHeight <= 0) {
            return null;
          }
          return (
            <Image
              key={item.id} source={{ uri: item.uri }}
              style={{ position: 'absolute', left: scaledItemX, top: scaledItemY, width: scaledItemWidth, height: scaledItemHeight, resizeMode: 'contain'}}
            />
          );
        })}
      </View>
    );
  };

  const isSelected = marking?.selected;
  const isDisabled = state === 'disabled';

  if (!date) {
    return <View style={[styles.dayCellBase, styles.dayCellDisabledOrEmpty]} />;
  }

  return (
    <TouchableOpacity
      style={[
        styles.dayCellBase,
        isDisabled && styles.dayCellDisabledOrEmpty,
        isSelected && !isDisabled && styles.dayCellSelected,
      ]}
      onPress={() => !isDisabled && onPress && date && onPress(date)}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      <Text style={[
        styles.dayText,
        isDisabled && styles.dayTextDisabled,
        isSelected && !isDisabled && styles.dayTextSelected,
      ]}>
        {date.day}
      </Text>
      {!isDisabled && assignedCollage ? renderMiniCollage(assignedCollage) : null}
    </TouchableOpacity>
  );
};

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [calendarDisplayMonth, setCalendarDisplayMonth] = useState<string>(new Date().toISOString().split('T')[0]);
  const [namedCollages, setNamedCollages] = useState<NamedCollage[]>([]);
  const [assignments, setAssignments] = useState<DateAssignments>({});
  const [markedDates, setMarkedDates] = useState<{ [date: string]: any }>({});
  const [assignedCollageForSelectedDate, setAssignedCollageForSelectedDate] = useState<NamedCollage | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCollagePickerModalVisible, setIsCollagePickerModalVisible] = useState(false);

  const getCollageById = useCallback((id: string): NamedCollage | undefined => {
    return namedCollages.find(c => c.id === id);
  }, [namedCollages]);

  const loadData = async () => {
    setIsLoadingData(true);
    try {
      const collagesJson = await AsyncStorage.getItem(NAMED_COLLAGES_STORAGE_KEY);
      const loadedCollages = collagesJson ? JSON.parse(collagesJson) : [];
      loadedCollages.sort((a: NamedCollage, b: NamedCollage) => b.timestamp - a.timestamp);
      setNamedCollages(loadedCollages);

      const assignmentsJson = await AsyncStorage.getItem(DATE_COLLAGE_ASSIGNMENTS_KEY);
      const loadedAssignments = assignmentsJson ? JSON.parse(assignmentsJson) : {};
      setAssignments(loadedAssignments);
      
      // Initial update based on selectedDate (which defaults to today)
      updateMarkedDates(selectedDate, loadedAssignments, loadedCollages); // Pass loadedCollages
      updateAssignedCollagePreview(selectedDate, loadedAssignments, loadedCollages);

    } catch (e) {
      console.error("Failed to load calendar data", e);
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // MODIFIED: updateMarkedDates to include assignedCollageId for CustomDayComponent
  const updateMarkedDates = (currentSelectedDate: string, currentAssignments: DateAssignments, currentNamedCollages: NamedCollage[]) => {
      // MODIFIED: Explicitly type newMarkedDates
      const newMarkedDates: { [key: string]: any } = {};
      Object.keys(currentAssignments).forEach(dateString => {
          const collageId = currentAssignments[dateString];
          // const collage = currentNamedCollages.find(c => c.id === collageId); // Not strictly needed here, CustomDayComponent will fetch
          newMarkedDates[dateString] = {
              assignedCollageId: collageId,
              // customStyles for non-selected assigned days if needed (e.g., a dot)
          };
      });
      
      if (currentSelectedDate) {
          newMarkedDates[currentSelectedDate] = {
               ...(newMarkedDates[currentSelectedDate] || {}), // Preserve assignedCollageId if any
               selected: true,
               // selectedColor is handled by CustomDayComponent's style for selected state
          };
      }
      setMarkedDates(newMarkedDates);
  };

  const updateAssignedCollagePreview = (date: string, currentAssignments: DateAssignments, currentNamedCollages: NamedCollage[]) => {
      const assignedCollageId = currentAssignments[date];
      if (assignedCollageId) {
          const foundCollage = currentNamedCollages.find(c => c.id === assignedCollageId);
          setAssignedCollageForSelectedDate(foundCollage || null);
      } else {
          setAssignedCollageForSelectedDate(null);
      }
  };

  const saveAssignments = async (updatedAssignments: DateAssignments) => {
    try {
      await AsyncStorage.setItem(DATE_COLLAGE_ASSIGNMENTS_KEY, JSON.stringify(updatedAssignments));
      setAssignments(updatedAssignments); // Update state after successful save
    } catch (e) {
      console.error("Failed to save assignments", e);
      // Optionally, show an alert to the user
    }
  };

  const handleAssignCollageToDate = (collageId: string) => {
    if (!selectedDate) return;
    const newAssignments = {
      ...assignments,
      [selectedDate]: collageId,
    };
    saveAssignments(newAssignments);
    setIsCollagePickerModalVisible(false); // Close modal on selection
  };

  const handleRemoveCollageFromDate = () => {
    if (!selectedDate) return;
    const newAssignments = { ...assignments };
    delete newAssignments[selectedDate];
    saveAssignments(newAssignments);
  };

  useFocusEffect(useCallback(() => { 
    // When screen focuses, reset calendar view to current selectedDate's month or today's month if selectedDate is far off
    // For simplicity, let's ensure calendarDisplayMonth is set based on selectedDate when focusing.
    // If selectedDate is today, calendarDisplayMonth will be today.
    setCalendarDisplayMonth(selectedDate); // Or new Date().toISOString().split('T')[0] if always reset to current month
    loadData(); 
  }, [])); // Re-evaluate if selectedDate should be dependency for setCalendarDisplayMonth here

  useEffect(() => {
      // Pass namedCollages here as well
      updateMarkedDates(selectedDate, assignments, namedCollages);
      updateAssignedCollagePreview(selectedDate, assignments, namedCollages);
  }, [selectedDate, assignments, namedCollages]);

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    setCalendarDisplayMonth(day.dateString); // Ensure calendar view updates to the pressed day's month
  };

  // ADDED: Function to go to current month and select today
  const goToCurrentMonthAndSelectToday = () => {
    const todayDateString = new Date().toISOString().split('T')[0];
    setCalendarDisplayMonth(todayDateString);
    setSelectedDate(todayDateString); // Also select today
  };

  const renderCustomHeader = (date: any) => {
    const month = date.toString('MMMM');
    const year = date.toString('yyyy');
    return (
      <View style={styles.customHeaderContainer}>
        <Text style={styles.customHeaderMonthYearText}>{`${month} ${year}`}</Text>
      </View>
    );
  };

  // Wrapper for CustomDayComponent to pass extra props
  const DayComponentWrapper = (props: any) => (
    <CustomDayComponent
      {...props} // Passes date, marking, state, onPress from react-native-calendars
      getCollageById={getCollageById}
    />
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.titleHeaderContainer}> 
        <ThemedText type="title" style={styles.pageTitle}>Calendar</ThemedText>
        <TouchableOpacity onPress={goToCurrentMonthAndSelectToday} style={styles.todayButton}>
          <Ionicons name="today-outline" size={24} color={AppColors.primaryText} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.calendarWrapper}>
         <Calendar
            onDayPress={onDayPress}
            markedDates={markedDates}
            dayComponent={DayComponentWrapper} // Use custom day component
            current={calendarDisplayMonth}
            key={calendarDisplayMonth}
            monthFormat={undefined} 
            renderHeader={renderCustomHeader}
            hideArrows={false}
            firstDay={1}
            enableSwipeMonths={true}
            onMonthChange={(month) => setCalendarDisplayMonth(month.dateString)}
            theme={{ 
              calendarBackground: AppColors.screenBackground,
              backgroundColor: AppColors.screenBackground,
              arrowColor: AppColors.primaryText,
              
              textDayFontFamily: 'System', 
              textDayFontSize: 14,
              dayTextColor: AppColors.primaryText,
              textDisabledColor: AppColors.secondaryText,
              todayTextColor: AppColors.primaryText,

              textSectionTitleColor: AppColors.secondaryText,
              textDayHeaderFontFamily: 'System',
              textDayHeaderFontSize: 14,
              textDayHeaderFontWeight: 'normal',
              
              monthTextColor: AppColors.primaryText,
              textMonthFontFamily: 'System',
              textMonthFontSize: 26, 
              textMonthFontWeight: 'bold',
            }}
          />
      </View>

      {isLoadingData && <ActivityIndicator size="large" color={AppColors.primaryText} style={{marginVertical: 20}}/>}

      {selectedDate && (
        <View style={styles.outfitSectionContainer}>
          <ThemedText style={styles.outfitSectionTitle}>
            Outfit for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </ThemedText>
          {assignedCollageForSelectedDate ? (
            <View style={styles.outfitCard}>
              <OriginalCollagePreview 
                items={assignedCollageForSelectedDate.items} 
                size={150}
                backgroundColor={'transparent'}
              />
              <TouchableOpacity onPress={handleRemoveCollageFromDate} style={styles.assignRemoveButton}>
                <Text style={styles.assignRemoveButtonText}>Remove Assignment</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.outfitCardEmpty}>
              <Text style={styles.emptyOutfitText}>No outfit assigned for this day.</Text>
              <TouchableOpacity onPress={() => setIsCollagePickerModalVisible(true)} style={styles.addOutfitButton}>
                <Text style={styles.addOutfitButtonText}>Add Outfit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={isCollagePickerModalVisible}
        onRequestClose={() => {
          setIsCollagePickerModalVisible(!isCollagePickerModalVisible);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalView}>
            <Text style={styles.modalTitle}>Select an Outfit</Text>
            <ScrollView contentContainerStyle={styles.modalCollagesList}>
              {namedCollages.map(collage => (
                <TouchableOpacity key={collage.id} onPress={() => handleAssignCollageToDate(collage.id)} style={styles.modalCollageItem}>
                  <OriginalCollagePreview items={collage.items} size={100} backgroundColor={AppColors.cardBackground} />
                  <Text style={styles.modalCollageName} numberOfLines={2}>{collage.name}</Text>
                </TouchableOpacity>
              ))}
              {namedCollages.length === 0 && (
                <Text style={styles.emptyListText}>You haven't saved any outfits yet.</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsCollagePickerModalVisible(!isCollagePickerModalVisible)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.screenBackground,
    paddingHorizontal: 15,
  },
  titleHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 70 : 50,
    marginBottom: 5,
  },
  pageTitle: {
    textAlign: 'center',
    fontSize: 36,
    fontFamily: 'Wasted-Vindey',
    color: AppColors.primaryText,
    lineHeight: 44,
    flex: 1,
  },
  todayButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  customHeaderContainer: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  customHeaderMonthYearText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: AppColors.primaryText,
    fontFamily: 'System', 
  },
  calendarWrapper: {
    marginVertical: 10,
  },
  dayCellBase: { 
    width: 48, 
    height: 48, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'flex-start', 
    paddingTop: 4, 
    paddingBottom: 4, 
    marginHorizontal: 4, 
    marginVertical: 0,   
    backgroundColor: AppColors.cardBackground,
    borderWidth: 0, 
  },
  dayCellSelected: {
    backgroundColor: '#bfaca0',
  },
  dayCellDisabledOrEmpty: { 
    backgroundColor: AppColors.cardBackground, 
    width: 48, 
    height: 48, 
    borderRadius: 8,
    marginHorizontal: 4, 
    marginVertical: 0,   
    borderWidth: 0, 
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    paddingBottom: 4,
  },
  dayText: {
    fontSize: 14, 
    color: AppColors.primaryText,
    marginBottom: 2, 
  },
  dayTextSelected: {
    fontWeight: 'bold',
  },
  dayTextDisabled: {
    color: AppColors.secondaryText,
  },
  miniCollagePlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 3, 
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dayMiniCollageImage: { 
    width: 20,
    height: 20,
    borderRadius: 3,
    overflow: 'hidden', 
  },

  outfitSectionContainer: {
    marginTop: 25,
    marginBottom: 30,
    alignItems: 'center',
  },
  outfitSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.primaryText,
    marginBottom: 15,
  },
  outfitCard: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 16,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    width: '90%',
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  outfitCardEmpty: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100, 
    width: '90%',
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyOutfitText: {
    fontSize: 15,
    color: AppColors.secondaryText,
    textAlign: 'center',
  },
  assignRemoveButton: {
    marginTop: 10,
    backgroundColor: AppColors.dangerButtonBackground,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  assignRemoveButtonText: {
    color: AppColors.primaryButtonText,
    fontSize: 14,
    fontWeight: '500',
  },
  addOutfitButton: {
    marginTop: 15,
    backgroundColor: AppColors.primaryButtonBackground,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  addOutfitButtonText: {
    color: AppColors.primaryButtonText,
    fontSize: 15,
    fontWeight: '600',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: AppColors.screenBackground,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: AppColors.primaryText,
  },
  modalCollagesList: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  modalCollageItem: {
    marginBottom: 15,
    alignItems: 'center',
    width: '100%', // Ensure items take full width within modal scroll
  },
  modalCollageName: {
    fontSize: 14,
    color: AppColors.primaryText,
    marginTop: 8,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: 15,
    backgroundColor: AppColors.secondaryText, // Or another color for close
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: AppColors.primaryButtonText,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyListText: {
    fontSize: 15,
    color: AppColors.secondaryText,
    textAlign: 'center',
  },
}); 
