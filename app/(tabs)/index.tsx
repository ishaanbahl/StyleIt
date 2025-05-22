import { Image, StyleSheet, Platform, View, Text, Alert, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Modal } from 'react-native';
import React, { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Link, useFocusEffect } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
// Import shared types
import { SavedImage, NamedCollage, CanvasItem } from '@/types/collage';
import CollagePreview from '@/components/CollagePreview';
// ADDED: Import AppColors from central location
import { AppColors } from '@/constants/Colors';
import { API_BASE_URL } from '@/constants/ApiConfig';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const STORAGE_KEY = '@StyleIt/SavedImages';
const NAMED_COLLAGES_STORAGE_KEY = '@StyleIt/NamedCollages';
const DATE_COLLAGE_ASSIGNMENTS_KEY = '@StyleIt/DateCollageAssignments';

// ADDED BACK: Interface for assignments map (copied from calendar.tsx for now)
interface DateAssignments {
  [dateString: string]: string;
}

// Define Picker options
const categoryOptions: { label: string; value: SavedImage['category'] }[] = [
  { label: "Top", value: "top" },
  { label: "Bottom", value: "bottom" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Full Body", value: "fullbody" },
  { label: "Footwear", value: "footwear" },
  { label: "Accessory", value: "accessory" },
];

const warmthOptions: { label: string; value: SavedImage['warmth'] }[] = [
  { label: "Light", value: "light" },
  { label: "Medium", value: "medium" },
  { label: "Warm", value: "warm" },
];

const occasionOptions: { label: string; value: SavedImage['occasion'] | undefined }[] = [
  { label: "Select Occasion...", value: undefined },
  { label: "Casual", value: "casual" },
  { label: "Formal", value: "formal" },
  { label: "Sporty", value: "sporty" },
  { label: "Business", value: "business" },
  { label: "Everyday", value: "everyday" },
];

export default function HomeScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('styled_image');
  const [isSaving, setIsSaving] = useState(false);

  // Get current date parts for Calendar widget
  const currentDate = new Date();
  const currentDay = currentDate.getDate();
  const currentMonth = currentDate.toLocaleString('default', { month: 'short' }); // e.g., "Dec"
  const todayDateString = currentDate.toISOString().split('T')[0]; // ADDED: YYYY-MM-DD format

  // ADDED: State for today's assigned collage
  const [todayAssignedCollage, setTodayAssignedCollage] = useState<NamedCollage | null>(null);
  const [isLoadingTodayCollage, setIsLoadingTodayCollage] = useState(true);

  // UPDATED: Initialize category and warmth with default values
  const [category, setCategory] = useState<SavedImage['category']>('top'); 
  const [warmth, setWarmth] = useState<SavedImage['warmth']>('medium');
  const [occasion, setOccasion] = useState<SavedImage['occasion']>(undefined);
  const [itemColor, setItemColor] = useState<string>('');
  const [itemTags, setItemTags] = useState<string>('');

  // ADDED: State for modal visibility
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isWarmthModalVisible, setIsWarmthModalVisible] = useState(false);
  const [isOccasionModalVisible, setIsOccasionModalVisible] = useState(false);

  // ADDED: Load today's assigned collage
  useFocusEffect(
    useCallback(() => {
      const loadTodaysCollage = async () => {
        setIsLoadingTodayCollage(true);
        setTodayAssignedCollage(null); 
        try {
          const assignmentsJson = await AsyncStorage.getItem(DATE_COLLAGE_ASSIGNMENTS_KEY);
          const assignments: DateAssignments = assignmentsJson ? JSON.parse(assignmentsJson) : {};
          
          const todaysCollageId = assignments[todayDateString];

          if (todaysCollageId) {
            const collagesJson = await AsyncStorage.getItem(NAMED_COLLAGES_STORAGE_KEY);
            const allCollages: NamedCollage[] = collagesJson ? JSON.parse(collagesJson) : [];
            
            const foundCollage = allCollages.find(c => c.id === todaysCollageId);
            if (foundCollage) {
              setTodayAssignedCollage(foundCollage);
            }
          }
        } catch (e) {
          console.error("[HomeScreen] Failed to load today's assigned collage", e);
        } finally {
          setIsLoadingTodayCollage(false);
        }
      };

      loadTodaysCollage();
      return () => {
      };
    }, [todayDateString]) 
  );

  const pickImage = async () => {
    setImageUri(null);
    setProcessedImageUrl(null);
    setError(null);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to grant permission to access the photo library.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    setImageUri(null);
    setProcessedImageUrl(null);
    setError(null);

    const cameraPermissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraPermissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to grant permission to use the camera.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, // You can allow editing for photos taken as well
      aspect: [4, 3],      // Or adjust as needed
      quality: 1,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setError(null);
    setProcessedImageUrl(null);
    setIsLoading(true);

    const backendUrl = `${API_BASE_URL}/api/remove-background`;
    const formData = new FormData();

    const uriParts = uri.split('/');
    const fileName = uriParts[uriParts.length - 1];
    let fileType = 'image/jpeg';
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    if (fileExt === 'png') {
      fileType = 'image/png';
    } else if (fileExt === 'jpg' || fileExt === 'jpeg') {
      fileType = 'image/jpeg';
    }

    formData.append('file', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: fileName,
      type: fileType,
    } as any);

    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        setProcessedImageUrl(result.output_url);
      } else {
        setError(result.error || 'Failed to process image. Status: ' + response.status);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setError(err.message || 'An unexpected error occurred during upload.');
    } finally {
      setIsLoading(false);
    }
  };

  const saveImage = async () => {
    if (!processedImageUrl) {
      Alert.alert("Error", "No processed image available to save.");
      return;
    }

    setIsSaving(true);
    setError(null);
    let downloadedUriForStorage = null;
    const userDefinedFilename = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const uniqueFileId = Crypto.randomUUID();

    try {
      const internalFilename = `${uniqueFileId}.png`;
      const localUri = FileSystem.documentDirectory + internalFilename;

      const { uri: downloadedUri } = await FileSystem.downloadAsync(processedImageUrl, localUri);
      downloadedUriForStorage = downloadedUri;
      console.log("Image downloaded for app storage:", downloadedUri);

      // --- Add to AsyncStorage ---
      const newImageRecord: SavedImage = {
        id: uniqueFileId,
        uri: downloadedUri,
        filename: userDefinedFilename,
        timestamp: Date.now(),
        category: category, // Now always defined
        warmth: warmth,   // Now always defined
        occasion: occasion || undefined,
        color: itemColor.trim() || undefined,
        tags: itemTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0).length > 0 
              ? itemTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) 
              : undefined,
      };

      const existingData = await AsyncStorage.getItem(STORAGE_KEY);
      const images: SavedImage[] = existingData ? JSON.parse(existingData) : [];
      images.push(newImageRecord);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(images));
      // --- End AsyncStorage Add ---

      Alert.alert("Success", "Styled image saved to your app!");
      
      // --- ADDED/MODIFIED: Reset UI state to allow new image upload ---
      setImageUri(null);                 // Clear originally selected image
      setProcessedImageUrl(null);        // Clear background-removed image
      setFileName('styled_image');         // Reset filename to default
      setError(null);                    // Clear any previous errors
      
      // Reset metadata fields
      setCategory('top');
      setWarmth('medium');
      setOccasion(undefined);
      setItemColor('');
      setItemTags('');
      // --- End Reset UI state ---

    } catch (err: any) {
      console.error("Save failed:", err);
      setError(err.message || 'Could not save image.');
      Alert.alert("Error", "Could not save image. " + (err.message || ''));

      if (downloadedUriForStorage) {
         await FileSystem.deleteAsync(downloadedUriForStorage, { idempotent: true });
         console.log("Cleaned up downloaded file due to save error:", downloadedUriForStorage);
      }

    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.scrollViewContainer}>
      <View style={styles.headerTitleContainer}>
        <ThemedText type="title" style={styles.headerTitleText}>StyleIt.</ThemedText>
      </View>

      <View style={styles.contentContainer}>
        {!processedImageUrl && !isLoading && (
          <View style={styles.stepContainer}>
            <ThemedText type="subtitle" style={styles.subtitleText}>Step 1: Pick an Image</ThemedText>
            <ThemedText style={styles.descriptionText}>
              Select an image of your clothing item.
            </ThemedText>
            
            <View style={styles.buttonRowContainer}>
              <TouchableOpacity style={[styles.buttonPrimary, styles.rowButton]} onPress={pickImage} disabled={isLoading}>
                <Text style={styles.buttonText}>From Library</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonPrimary, styles.rowButton]} onPress={takePhoto} disabled={isLoading}>
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>

            {imageUri && (
              <View style={styles.imageContainer}>
                <ThemedText type="defaultSemiBold" style={styles.labelText}>Selected Image:</ThemedText>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.buttonPrimary} onPress={() => uploadImage(imageUri)} disabled={isLoading || !imageUri}>
                  <Text style={styles.buttonText}>Remove Background</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {isLoading && (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#000000" />
                <Text style={styles.loadingText}>Processing...</Text>
            </View>
        )}

        {error && <Text style={styles.errorText}>Error: {error}</Text>}

        {processedImageUrl && !isLoading && (
          <View style={styles.stepContainer}> 
            <ThemedText type="subtitle" style={styles.subtitleText}>Your Styled Item</ThemedText>
            <View style={styles.imageContainer}>
              <Image source={{ uri: processedImageUrl }} style={styles.imagePreview} />
            </View>
          </View>
        )}

        {(processedImageUrl && !isLoading) && (
          <View style={[styles.stepContainer, styles.resultsContainer]}> 
            <ThemedText type="subtitle" style={styles.subtitleText}>Step 2: Save Item</ThemedText>
            {/* ADDED: User guidance text */}
            <ThemedText style={[styles.descriptionText, { marginTop: -5, marginBottom: 10 }]}>
              Category and Warmth are essential for the AI Stylist to create outfits!
            </ThemedText>
            <View style={styles.saveSection}>
              <ThemedText type="defaultSemiBold" style={styles.labelText}>Save as:</ThemedText>
              <TextInput
                style={styles.input}
                value={fileName}
                onChangeText={setFileName}
                placeholder="Enter filename (e.g., cool_shirt.png)"
                placeholderTextColor={AppColors.secondaryText}
                editable={!isSaving}
              />

              {/* --- Category Picker (Modal) --- */}
              <ThemedText type="defaultSemiBold" style={styles.labelText}>Category: <Text style={styles.requiredAsterisk}>*</Text></ThemedText>
              <TouchableOpacity 
                style={styles.pickerInputButton} 
                onPress={() => setIsCategoryModalVisible(true)}
                disabled={isSaving}
              >
                <Text style={styles.pickerInputButtonText}>
                  {categoryOptions.find(opt => opt.value === category)?.label || 'Select Category'}
                </Text>
              </TouchableOpacity>
              <Modal
                animationType="slide"
                transparent={true}
                visible={isCategoryModalVisible}
                onRequestClose={() => setIsCategoryModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContentContainer}>
                    <Picker
                      selectedValue={category}
                      onValueChange={(itemValue) => setCategory(itemValue)}
                      style={styles.modalPicker}
                      itemStyle={styles.modalPickerItem} // For iOS item styling if needed
                    >
                      {categoryOptions.map(opt => <Picker.Item key={opt.label} label={opt.label} value={opt.value} />)}
                    </Picker>
                    <TouchableOpacity style={styles.modalDoneButton} onPress={() => setIsCategoryModalVisible(false)}>
                      <Text style={styles.modalDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* --- Warmth Picker (Modal - to be implemented similarly) --- */}
              <ThemedText type="defaultSemiBold" style={styles.labelText}>Warmth: <Text style={styles.requiredAsterisk}>*</Text></ThemedText>
              <TouchableOpacity 
                style={styles.pickerInputButton} 
                onPress={() => setIsWarmthModalVisible(true)}
                disabled={isSaving}
              >
                <Text style={styles.pickerInputButtonText}>
                  {warmthOptions.find(opt => opt.value === warmth)?.label || 'Select Warmth'}
                </Text>
              </TouchableOpacity>
              <Modal
                animationType="slide"
                transparent={true}
                visible={isWarmthModalVisible}
                onRequestClose={() => setIsWarmthModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContentContainer}>
                    <Picker
                      selectedValue={warmth}
                      onValueChange={(itemValue) => setWarmth(itemValue)}
                      style={styles.modalPicker}
                      itemStyle={styles.modalPickerItem}
                    >
                      {warmthOptions.map(opt => <Picker.Item key={opt.label} label={opt.label} value={opt.value} />)}
                    </Picker>
                    <TouchableOpacity style={styles.modalDoneButton} onPress={() => setIsWarmthModalVisible(false)}>
                      <Text style={styles.modalDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              {/* --- Occasion Picker (Modal - to be implemented similarly) --- */}
              <ThemedText type="defaultSemiBold" style={styles.labelText}>Occasion:</ThemedText>
              <TouchableOpacity 
                style={styles.pickerInputButton} 
                onPress={() => setIsOccasionModalVisible(true)}
                disabled={isSaving}
              >
                <Text style={styles.pickerInputButtonText}>
                  {occasionOptions.find(opt => opt.value === occasion)?.label || 'Select Occasion...'}
                </Text>
              </TouchableOpacity>
              <Modal
                animationType="slide"
                transparent={true}
                visible={isOccasionModalVisible}
                onRequestClose={() => setIsOccasionModalVisible(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContentContainer}>
                    <Picker
                      selectedValue={occasion}
                      onValueChange={(itemValue) => setOccasion(itemValue || undefined)}
                      style={styles.modalPicker}
                      itemStyle={styles.modalPickerItem}
                    >
                      {occasionOptions.map(opt => <Picker.Item key={opt.label} label={opt.label} value={opt.value} />)}
                    </Picker>
                    <TouchableOpacity style={styles.modalDoneButton} onPress={() => setIsOccasionModalVisible(false)}>
                      <Text style={styles.modalDoneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>

              <ThemedText type="defaultSemiBold" style={styles.labelText}>Color:</ThemedText>
              <TextInput
                style={styles.input}
                value={itemColor}
                onChangeText={setItemColor}
                placeholder="e.g., Red, Blue, Black (optional)"
                placeholderTextColor={AppColors.secondaryText}
                editable={!isSaving}
              />

              <ThemedText type="defaultSemiBold" style={styles.labelText}>Tags (comma-separated):</ThemedText>
              <TextInput
                style={styles.input}
                value={itemTags}
                onChangeText={setItemTags}
                placeholder="e.g., summer, comfy (optional)"
                placeholderTextColor={AppColors.secondaryText}
                editable={!isSaving}
              />

              <TouchableOpacity 
                style={[styles.buttonPrimary, isSaving && styles.buttonDisabled]} 
                onPress={saveImage} 
                disabled={isSaving || !processedImageUrl}
              >
                <Text style={styles.buttonText}>{isSaving ? "Saving..." : "Save to Gallery"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.quickAccessContainer}>
        <Link href="/(tabs)/gallery" asChild>
          <TouchableOpacity style={styles.quickAccessCard}>
            <View style={styles.widgetOutfitPreviewPlaceholder}>
              <Ionicons name="folder-outline" size={36} color={AppColors.iconColor} />
            </View>
            <ThemedText style={styles.quickAccessTitle}>My Gallery</ThemedText>
          </TouchableOpacity>
        </Link>
        <Link href="/(tabs)/calendar" asChild>
          <TouchableOpacity style={styles.quickAccessCard}>
            <View style={styles.widgetOutfitPreviewPlaceholder}>
              <Ionicons name="calendar-outline" size={36} color={AppColors.iconColor} />
            </View>
            <ThemedText style={styles.quickAccessTitle}>Outfits Calendar</ThemedText>
          </TouchableOpacity>
        </Link>

        <Link href="/(tabs)/stylist" asChild>
          <TouchableOpacity style={styles.quickAccessCard}>
            <View style={styles.widgetOutfitPreviewPlaceholder}>
              <Ionicons name="sparkles-outline" size={36} color={AppColors.iconColor} />
            </View>
            <ThemedText style={styles.quickAccessTitle}>AI Stylist</ThemedText>
          </TouchableOpacity>
        </Link>

        <Link href="/(tabs)/collage" asChild>
          <TouchableOpacity style={styles.quickAccessCard}>
            <View style={styles.widgetOutfitPreviewPlaceholder}>
              <Ionicons name="create-outline" size={36} color={AppColors.iconColor} />
            </View>
            <ThemedText style={styles.quickAccessTitle}>Collage Studio</ThemedText>
          </TouchableOpacity>
        </Link>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollViewContainer: {
    flex: 1,
    backgroundColor: AppColors.screenBackground, 
  },
  headerTitleContainer: {
    paddingTop: 80, 
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center', 
    backgroundColor: AppColors.screenBackground, 
  },
  headerTitleText: {
    fontSize: 36, 
    color: AppColors.primaryText, 
    fontFamily: 'Wasted-Vindey', 
    lineHeight: 44, 
  },
  quickAccessContainer: { 
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 15, 
    paddingVertical: 20, 
    marginTop: 10, 
    gap: 15, 
    backgroundColor: AppColors.screenBackground, 
  },
  quickAccessCard: { 
    width: '45%', 
    backgroundColor: AppColors.secondaryCardBackground, 
    paddingVertical: 20, 
    paddingHorizontal: 10, 
    borderRadius: 20, 
    alignItems: 'center',
    shadowColor: AppColors.primaryText, 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, 
    shadowRadius: 8,  
    elevation: 3, 
    minHeight: 130, 
  },
  quickAccessTitle: { 
    fontSize: 14,
    color: AppColors.primaryText, 
    fontWeight: '500', 
    textAlign: 'center',
    marginTop: 10, 
    lineHeight: 18, 
  },
  widgetOutfitPreviewPlaceholder: {
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 0, 
  },
  widgetCalendarDateContainer: { 
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5, 
    height: 48,
    width: '100%',
    borderRadius: 12,
    gap: 2,
  },
  widgetLoader: {
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  widgetNoCollageText: {
    fontSize: 13, 
    color: AppColors.primaryText,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 0,
  },
  widgetInfoText: {
    fontSize: 10, 
    color: AppColors.secondaryText,
    textAlign: 'center',
    marginTop: 0,
  },
  contentContainer: {
    paddingHorizontal: 15, 
    paddingBottom: 10, 
  },
  stepContainer: { 
    gap: 16,
    marginBottom: 25,
    padding: 25, 
    backgroundColor: AppColors.cardBackground, 
    borderRadius: 25, 
    shadowColor: AppColors.primaryText, 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, 
    shadowRadius: 12,
    elevation: 5,
  },
  imageContainer: {
    marginTop: 0,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 16,
  },
  imagePreview: {
    width: '100%',
    aspectRatio: 1,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: AppColors.inputBorder,
    borderRadius: 12,
    backgroundColor: AppColors.inputBackground,
  },
  errorText: {
    color: AppColors.errorText,
    textAlign: 'center',
    fontSize: 15,
    padding: 15,
    backgroundColor: AppColors.errorBackground,
    borderRadius: 12,
    marginVertical: 10,
  },
  loadingContainer: {
    marginVertical: 30,
    alignItems: 'center',
    gap: 15,
  },
  loadingText: {
    fontSize: 16,
    color: AppColors.loadingText, 
  },
  resultsContainer: {
    marginTop: 0,
  },
  saveSection: {
    marginTop: 5,
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  input: {
    height: 50,
    width: '100%',
    borderColor: AppColors.inputBorder,
    color: AppColors.primaryText,
    borderWidth: 1,
    paddingHorizontal: 18,
    borderRadius: 12, 
    backgroundColor: AppColors.inputBackground,
    fontSize: 16,
    marginBottom: 10,
  },
  pickerInputButton: {
    height: 50,
    width: '100%',
    borderColor: AppColors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: AppColors.inputBackground,
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  pickerInputButtonText: {
    fontSize: 16,
    color: AppColors.primaryText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContentContainer: {
    backgroundColor: AppColors.cardBackground, // Use card background for modal
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
  },
  modalPicker: {
    width: '100%',
    // ADDED: Explicitly set color for picker items if possible, though often platform-styled
    // color: AppColors.primaryText, // This might not work on all platforms for Picker item text
  },
  modalPickerItem: {
    // ADDED: For iOS item styling
    // color: AppColors.primaryText, // This is the correct way for iOS
    // fontSize: 18, // Example
  },
  modalDoneButton: {
    backgroundColor: AppColors.primaryButtonBackground, 
    paddingVertical: 14, 
    paddingHorizontal: 30,
    borderRadius: 20, 
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 15,
  },
  modalDoneButtonText: {
    color: AppColors.primaryButtonText, 
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: AppColors.primaryButtonBackground, 
    paddingVertical: 16, 
    paddingHorizontal: 25, 
    borderRadius: 25, 
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%', 
    elevation: 2, 
    shadowColor: AppColors.primaryText, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 4,
  },
  buttonRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
  },
  rowButton: {
    flex: 1,
    paddingHorizontal: 10, 
  },
  buttonText: {
    color: AppColors.primaryButtonText, 
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: AppColors.buttonDisabledBackground,
    shadowOpacity: 0,
    elevation: 0,
  },
  subtitleText: { 
    color: AppColors.primaryText, 
    fontSize: 22, 
    fontWeight: 'bold', 
    textAlign: 'center',
  },
  descriptionText: { 
    color: AppColors.secondaryText, 
    fontSize: 15, 
    textAlign: 'center',
    paddingHorizontal: 10,
    lineHeight: 22, 
  },
  labelText: { 
    color: AppColors.primaryText, 
    fontSize: 16,
    fontWeight: '600', 
  },
  requiredAsterisk: {
    color: AppColors.errorText, // Use error color for asterisk
    fontSize: 16,
  },
});
