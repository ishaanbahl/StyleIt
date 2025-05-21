import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, Image, ActivityIndicator, Button, ScrollView, TextInput, TouchableOpacity, Modal, Pressable, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router'; // To reload when tab is focused

// Import shared type
import { SavedImage, NamedCollage, CanvasItem } from '@/types/collage';
import { ThemedText } from '@/components/ThemedText';
import CollagePreview from '@/components/CollagePreview'; // Shared component is imported
import { Ionicons } from '@expo/vector-icons'; // Added Ionicons

// ADDED: Import AppColors from central location
import { AppColors } from '@/constants/Colors';

// Define the structure of the saved image metadata
// interface SavedImage { ... } // Removed

const STORAGE_KEY = '@StyleIt/SavedImages';
const NAMED_COLLAGES_STORAGE_KEY = '@StyleIt/NamedCollages';

// --- CollagePreview Component Placeholder ---
// We will implement this next
/*
const CollagePreview = ({ items, size }: { items: CanvasItem[], size: number }) => (
    <View style={[styles.previewContainer, { width: size, height: size }]}>
        <Text style={{ color: '#999' }}>Preview</Text>
         // TODO: Render scaled items
    </View>
);
*/

// --- CollagePreview Component Implementation ---

// REMOVE THE ENTIRE LOCAL CollagePreview DEFINITION BELOW THIS LINE
// const CollagePreview = ({ items, size }: { items: CanvasItem[], size: number }) => {
//     if (!items || items.length === 0) { ... }
//     // ... all the way to its closing };
// };
// END OF REMOVAL

export default function GalleryScreen() {
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [namedCollages, setNamedCollages] = useState<NamedCollage[]>([]);
  const [isLoadingCollages, setIsLoadingCollages] = useState(false);

  // --- Modal State ---
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalData, setModalData] = useState<any[]>([]);
  const [renderModalListItem, setRenderModalListItem] = useState<(item: any) => React.JSX.Element | null>(() => null);
  const [modalNumColumns, setModalNumColumns] = useState(1);
  const [modalSearchText, setModalSearchText] = useState('');
  const [modalContentType, setModalContentType] = useState<'items' | 'outfits' | null>(null);

  // Function to load images from AsyncStorage
  const loadAllData = async () => {
    setIsLoadingImages(true);
    setIsLoadingCollages(true);
    setError(null);
    try {
      // Load saved individual images
      const imagesJson = await AsyncStorage.getItem(STORAGE_KEY);
      const images = imagesJson != null ? JSON.parse(imagesJson) : [];
      images.sort((a: SavedImage, b: SavedImage) => b.timestamp - a.timestamp);
      setSavedImages(images);

      // Load saved named collages
      const collagesJson = await AsyncStorage.getItem(NAMED_COLLAGES_STORAGE_KEY);
      const collages = collagesJson != null ? JSON.parse(collagesJson) : [];
      collages.sort((a: NamedCollage, b: NamedCollage) => b.timestamp - a.timestamp);
      setNamedCollages(collages);

    } catch (e) {
      console.error("Failed to load data from storage", e);
      setError("Failed to load gallery data.");
    } finally {
      setIsLoadingImages(false);
      setIsLoadingCollages(false);
    }
  };

  // Use useFocusEffect to reload all data
  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  // ADDED: Delete Handler
  const handleDeleteItem = async (id: string, type: 'image' | 'collage') => {
    Alert.alert(
      "Delete Item",
      "Are you sure you want to delete this item?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const storageKey = type === 'image' ? STORAGE_KEY : NAMED_COLLAGES_STORAGE_KEY;
              const currentDataJson = await AsyncStorage.getItem(storageKey);
              let currentData: any[] = currentDataJson ? JSON.parse(currentDataJson) : [];
              
              currentData = currentData.filter(item => item.id !== id);
              await AsyncStorage.setItem(storageKey, JSON.stringify(currentData));

              if (type === 'image') {
                setSavedImages(currentData as SavedImage[]);
                if (isModalVisible && modalContentType === 'items') {
                  setModalData(currentData as SavedImage[]);
                }
              } else {
                setNamedCollages(currentData as NamedCollage[]);
                if (isModalVisible && modalContentType === 'outfits') {
                  setModalData(currentData as NamedCollage[]);
                }
              }
            } catch (e) {
              console.error("Failed to delete item", e);
              Alert.alert("Error", "Failed to delete item.");
            }
          },
        },
      ]
    );
  };

  const renderImageItem = ({ item }: { item: SavedImage }) => (
    <View style={styles.itemContainer}>
      <Image source={{ uri: item.uri }} style={styles.image} />
      <Text style={styles.filenameText}>{item.filename}.png</Text>
      <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleString()}</Text>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteItem(item.id, 'image')}>
        <Ionicons name="trash-outline" size={18} color={"rgba(255, 255, 255, 0.7)"} />
      </TouchableOpacity>
    </View>
  );

  // --- Render Item for Saved Collages List ---
  const renderNamedCollageItem = ({ item }: { item: NamedCollage }) => (
    <View style={styles.collageItemContainer}>
      <CollagePreview 
        items={item.items} 
        size={styles.previewGridCell.width}
        backgroundColor={AppColors.cardBackground}
      />
      <ThemedText style={styles.collageName} numberOfLines={1}>{item.name}</ThemedText>
    </View>
  );

  // Function to clear all saved images (for testing/debugging)
  const clearAllImages = async () => {
      Alert.alert("Clear All Images?", "This will delete all your saved items. This action cannot be undone.", [
        {text: "Cancel", style: "cancel"},
        {text: "Delete All", style: "destructive", onPress: async () => {
            try {
                await AsyncStorage.removeItem(STORAGE_KEY);
                setSavedImages([]);
                if (isModalVisible && modalContentType === 'items') closeModal();
                Alert.alert("Success", "All items cleared!");
            } catch (e) {
                Alert.alert("Error", "Failed to clear items.");
            }
        }}
      ]);
  }

  // Function to clear saved collages (Debug)
  const clearAllCollages = async () => {
      Alert.alert("Clear All Outfits?", "This will delete all your saved outfits. This action cannot be undone.", [
        {text: "Cancel", style: "cancel"},
        {text: "Delete All", style: "destructive", onPress: async () => {
            try {
                await AsyncStorage.removeItem(NAMED_COLLAGES_STORAGE_KEY);
                setNamedCollages([]);
                if (isModalVisible && modalContentType === 'outfits') closeModal();
                Alert.alert("Success", "All outfits cleared!");
            } catch (e) {
                Alert.alert("Error", "Failed to clear outfits.");
            }
        }}
      ]);
  }

  const openItemsModal = () => {
    setModalTitle('All Your Items');
    setModalData(savedImages);
    setRenderModalListItem(() => renderImageItem);
    setModalNumColumns(2);
    setModalSearchText('');
    setModalContentType('items');
    setIsModalVisible(true);
  };

  const openCollagesModal = () => {
    setModalTitle('All Your Outfits');
    setModalData(namedCollages);
    setRenderModalListItem(() => renderNamedCollageItemModal);
    setModalNumColumns(2);
    setModalSearchText('');
    setModalContentType('outfits');
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setModalTitle('');
    setModalData([]);
    setModalSearchText('');
    setModalContentType(null);
  };

  // Renderer for collages when in the modal
  const renderNamedCollageItemModal = ({ item }: { item: NamedCollage }) => (
    <View style={styles.itemContainer}> 
      <CollagePreview 
        items={item.items} 
        size={100}
        backgroundColor={'transparent'}
      />
      <ThemedText style={styles.collageName} numberOfLines={1}>{item.name}</ThemedText>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteItem(item.id, 'collage')}>
        <Ionicons name="trash-outline" size={18} color={"rgba(255, 255, 255, 0.7)"} />
      </TouchableOpacity>
    </View>
  );

  // ADDED: Filter logic for modal data based on modalSearchText
  const filteredModalData = useMemo(() => {
    if (!modalSearchText) return modalData;
    if (modalContentType === 'items') {
      return modalData.filter(item => item.filename.toLowerCase().includes(modalSearchText.toLowerCase()));
    } else if (modalContentType === 'outfits') {
      return modalData.filter(item => item.name.toLowerCase().includes(modalSearchText.toLowerCase()));
    }
    return modalData;
  }, [modalData, modalSearchText, modalContentType]);

  return (
    <>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          {/* MODIFIED: Removed headerContainer and debug toggle, pageTitle is standalone */}
          <ThemedText type="title" style={styles.pageTitle}>Gallery</ThemedText>

          {/* --- Section: Individual Items --- */}
          <View style={styles.itemsGridSection}> 
            <ThemedText type="subtitle" style={styles.sectionTitle}>Your Items</ThemedText>
            {isLoadingImages && <ActivityIndicator style={styles.activityIndicator} size="large" color={AppColors.primaryText} />}
            {error && <Text style={styles.errorText}>{error}</Text>}
            {!isLoadingImages && !error && savedImages.length === 0 && (
              <Text style={styles.emptyText}>No images saved yet.</Text>
            )}
            {!isLoadingImages && !error && savedImages.length > 0 && (
              <TouchableOpacity onPress={openItemsModal} style={styles.previewGridClickableArea}>
                <View style={styles.previewGridContainer}>
                  {savedImages.slice(0, 16).map((image) => (
                    <View key={image.id} style={styles.previewGridCell}>
                      <Image source={{ uri: image.uri }} style={styles.previewGridImage} />
                    </View>
                  ))}
                  {Array.from({ length: Math.max(0, 16 - savedImages.slice(0, 16).length) }).map((_, idx) => (
                    <View key={`placeholder-item-${idx}`} style={[styles.previewGridCell, styles.previewGridCellEmpty]} />
                  ))}
                </View>
                {savedImages.length > 16 && <Text style={styles.seeAllText}>See all ({savedImages.length})</Text>}
              </TouchableOpacity>
            )}
          </View>

          {/* --- Section: Saved Collages --- */}
          <View style={styles.collagesGridSection}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Your Outfits</ThemedText>
            {isLoadingCollages && <ActivityIndicator style={styles.activityIndicator} size="large" color={AppColors.primaryText} />}
            {!isLoadingCollages && error && <Text style={styles.errorText}>{error}</Text>}
            {!isLoadingCollages && !error && namedCollages.length === 0 && (
                <Text style={styles.emptyText}>No outfits saved yet.</Text>
            )}
            {/* 4x4 Preview Grid for Collages */}
            {!isLoadingCollages && !error && namedCollages.length > 0 && (
                <TouchableOpacity onPress={openCollagesModal} style={styles.previewGridClickableArea}>
                    <View style={styles.previewGridContainer}>
                        {namedCollages.slice(0, 16).map((collage) => (
                            <View key={collage.id} style={styles.previewGridCell}>
                                <CollagePreview 
                                  items={collage.items} 
                                  size={styles.previewGridCell.width}
                                  backgroundColor={AppColors.cardBackground}
                                /> 
                            </View>
                        ))}
                        {Array.from({ length: Math.max(0, 16 - namedCollages.slice(0, 16).length) }).map((_, idx) => (
                           <View key={`placeholder-collage-${idx}`} style={[styles.previewGridCell, styles.previewGridCellEmpty]} />
                        ))}
                    </View>
                    {namedCollages.length > 16 && <Text style={styles.seeAllText}>See all ({namedCollages.length})</Text>}
                </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      {/* --- Modal Implementation --- */}
      <Modal
          animationType="slide"
          transparent={true}
          visible={isModalVisible}
          onRequestClose={closeModal}
      >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContentContainer}>
                  <View style={styles.modalHeader}>
                      <ThemedText style={styles.modalTitleStyle}>{modalTitle}</ThemedText>
                      <Pressable onPress={closeModal} style={styles.modalCloseButton}>
                          <Ionicons name="close-circle-outline" size={28} color={AppColors.secondaryText} />
                      </Pressable>
                  </View>
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder={`Search ${modalContentType === 'items' ? 'items' : 'outfits'}...`}
                    placeholderTextColor={AppColors.secondaryText}
                    value={modalSearchText}
                    onChangeText={setModalSearchText}
                    clearButtonMode="while-editing"
                  />
                  {filteredModalData.length > 0 ? (
                      <FlatList
                          data={filteredModalData}
                          renderItem={renderModalListItem}
                          keyExtractor={(item) => item.id}
                          numColumns={modalNumColumns} 
                          contentContainerStyle={styles.listContainer}
                      />
                  ) : (
                      <Text style={styles.emptyText}>
                        {modalSearchText ? `No ${modalContentType === 'items' ? 'items' : 'outfits'} found matching "${modalSearchText}".` : 'Nothing to show here.' }
                      </Text>
                  )}
              </View>
          </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 30, 
  },
  container: {
    flex: 1,
    paddingHorizontal: 15, 
    paddingTop: 0, 
    backgroundColor: AppColors.screenBackground, // ENSURE THIS IS APPLIED
  },
  pageTitle: { 
    textAlign: 'center',
    fontSize: 36, 
    fontWeight: 'normal',
    color: AppColors.primaryText, 
    fontFamily: 'Wasted-Vindey',
    lineHeight: 44, 
    marginTop: Platform.OS === 'ios' ? 80 : 60, 
    marginBottom: 20,
  },
  sectionTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', // Matched home page subtitle
    color: AppColors.primaryText, // Matched home page subtitle
    marginTop: 20, 
    marginBottom: 15, 
  },
  itemsGridSection: { 
    flex: 0.5, // Adjusted flex for 50/50 split initially
    marginBottom: 10, 
  },
  collagesGridSection: { 
    marginBottom: 30, // Increased margin for more space between sections
  },
  activityIndicator: {
      marginTop: 20,
      color: '#333333', // Consistent loader color
  },
  listContainer: {
    paddingHorizontal: 5,
    paddingBottom: 20, // Add padding at the bottom of the list
  },
  itemContainer: {
    flex: 1,
    margin: 8, 
    padding: 10,
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, 
    shadowRadius: 2,
    elevation: 1, 
  },
  image: {
    width: '100%', // Make image responsive within the container
    aspectRatio: 1, // Keep it square
    resizeMode: 'cover', // Changed from contain to cover for better fill
    marginBottom: 10,
    borderRadius: 6, // Softer radius for image itself
  },
  filenameText: {
    fontSize: 13, // Slightly smaller
    fontWeight: '600', // Semi-bold
    color: '#333333', // Darker text
    textAlign: 'center',
    marginBottom: 2, // Space between filename and date
  },
  dateText: {
    fontSize: 11, // Slightly smaller
    color: '#777777', // Lighter grey for date
    marginTop: 0,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 20,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20, // Reduced margin for in-grid empty states
    fontSize: 15, 
    color: '#666666', 
    paddingHorizontal: 20,
  },
  previewContainer: {
      width: 100, 
      height: 100,
      backgroundColor: '#f0f0f0', // Lighter background for preview
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
      borderRadius: 6, // Softer radius
      overflow: 'hidden', 
      position: 'relative', 
  },
  collageListContainer: {
       paddingVertical: 5, // Adjusted padding
       paddingHorizontal: 0, // No horizontal padding if items have their own margin
  },
  collageItemContainer: {
      marginHorizontal: 8,
      alignItems: 'center',
      padding: 8, // Add some padding
      borderRadius: 10, // Match itemContainer
      backgroundColor: '#ffffff', // Match itemContainer
      width: 120, // Fixed width to accommodate preview + name
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
  },
  collageName: {
       fontSize: 13, // Match filenameText
       fontWeight: '600', // Match filenameText
       color: '#333333', // Match filenameText
       textAlign: 'center',
       marginTop: 4, // More space above name
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 20,
  },
  previewGridClickableArea: {
    alignItems: 'center', 
  },
  previewGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 10,      
    marginBottom: 8, 
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 4,
  },
  previewGridCell: {
    width: 70, 
    height: 70, 
    margin: 5, 
    backgroundColor: AppColors.cardBackground, // Light beige #f8efe4 for cells with content
    borderRadius: 8, 
    overflow: 'hidden', 
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewGridCellEmpty: {
    backgroundColor: '#E1D4C0', // Darker beige/taupe for empty cells
    borderRadius: 8, 
    width: 70, 
    height: 70,
    margin: 5,
  },
  previewGridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderRadius: 8, // Match cell borderRadius if overflow:hidden is not enough
  },
  seeAllText: {
    color: AppColors.primaryText, 
    fontSize: 15, // Slightly larger
    fontWeight: '600', // Semi-bold
    marginTop: 10, // Space above
    paddingVertical: 8, 
    paddingHorizontal: 12, // Add some padding for touch area
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)', 
    justifyContent: 'flex-end', 
  },
  modalContentContainer: {
    backgroundColor: AppColors.screenBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 15, 
    paddingTop: 15, 
    paddingBottom: Platform.OS === 'ios' ? 30 : 20, 
    maxHeight: '90%', 
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 }, 
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomColor: AppColors.inputBorder,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  modalTitleStyle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.primaryText,
  },
  modalCloseButton: {
    padding: 5,
  },
  deleteButton: {
    backgroundColor: 'rgba(183, 28, 28, 0.7)',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 5,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 35,
  },
  modalSearchInput: {
    height: 50,
    borderColor: AppColors.inputBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    marginBottom: 15,
    backgroundColor: AppColors.inputBackground,
    fontSize: 16,
    color: AppColors.primaryText,
  },
}); 
