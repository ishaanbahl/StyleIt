import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { StyleSheet, View, Text, FlatList, Image, Dimensions, LayoutChangeEvent, TextInput, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Crypto from 'expo-crypto';
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedGestureHandler, withSpring, runOnJS, interpolateColor } from 'react-native-reanimated';
import { SavedImage, CanvasItem, NamedCollage } from '@/types/collage';
import { AppColors } from '@/constants/Colors';

const STORAGE_KEY = '@StyleIt/SavedImages';
const LAST_COLLAGE_STATE_KEY = '@StyleIt/LastCollageState';
const NAMED_COLLAGES_STORAGE_KEY = '@StyleIt/NamedCollages';

const windowWidth = Dimensions.get('window').width;

type DraggableThumbnailProps = {
    item: SavedImage;
    canvasLayout: { x: number; y: number; width: number; height: number } | null;
    onDropOnCanvas: (item: SavedImage, dropX: number, dropY: number) => void;
};

const DraggableThumbnail: React.FC<DraggableThumbnailProps> = ({ item, canvasLayout, onDropOnCanvas }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const isDragging = useSharedValue(false);
    const startingPosition = useSharedValue({ x: 0, y: 0 });

    const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number, startY: number }>(
        {
            onStart: (_, ctx) => {
                isDragging.value = true;
                ctx.startX = translateX.value;
                ctx.startY = translateY.value;
            },
            onActive: (event, ctx) => {
                translateX.value = ctx.startX + event.translationX;
                translateY.value = ctx.startY + event.translationY;
            },
            onEnd: (event) => {
                if (canvasLayout) {
                    const droppedOnCanvasX = event.absoluteX >= canvasLayout.x && event.absoluteX <= canvasLayout.x + canvasLayout.width;
                    const droppedOnCanvasY = event.absoluteY >= canvasLayout.y && event.absoluteY <= canvasLayout.y + canvasLayout.height;

                    if (droppedOnCanvasX && droppedOnCanvasY) {
                        const dropX = event.absoluteX - canvasLayout.x;
                        const dropY = event.absoluteY - canvasLayout.y;
                        runOnJS(onDropOnCanvas)(item, dropX, dropY);
                    }
                }
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
                isDragging.value = false;
            },
        }
    );

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { scale: isDragging.value ? withSpring(1.1) : withSpring(1.0) },
            ],
            zIndex: isDragging.value ? 100 : 1,
            opacity: isDragging.value ? 0.8 : 1.0,
        };
    });

    return (
        <PanGestureHandler onGestureEvent={gestureHandler}>
            <Animated.View style={[styles.thumbnailContainer, animatedStyle]}>
                <Image source={{ uri: item.uri }} style={styles.thumbnail} />
            </Animated.View>
        </PanGestureHandler>
    );
};

type DraggableCanvasItemProps = {
    item: CanvasItem;
    onPositionUpdate: (id: string, x: number, y: number) => void;
    onDeleteItem: (id: string) => void;
    deleteZoneLayout: { x: number; y: number; width: number; height: number } | null;
    isOverDeleteZone: Animated.SharedValue<boolean>;
};

const DraggableCanvasItem: React.FC<DraggableCanvasItemProps> = ({
    item,
    onPositionUpdate,
    onDeleteItem,
    deleteZoneLayout,
    isOverDeleteZone,
}) => {
    const translateX = useSharedValue(item.x);
    const translateY = useSharedValue(item.y);
    const isDragging = useSharedValue(false);

    const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { startX: number, startY: number }>(
        {
            onStart: (_, ctx) => {
                isDragging.value = true;
                ctx.startX = translateX.value;
                ctx.startY = translateY.value;
            },
            onActive: (event, ctx) => {
                translateX.value = ctx.startX + event.translationX;
                translateY.value = ctx.startY + event.translationY;

                if (deleteZoneLayout) {
                    const currentX = event.absoluteX;
                    const currentY = event.absoluteY;
                    isOverDeleteZone.value =
                        currentX >= deleteZoneLayout.x &&
                        currentX <= deleteZoneLayout.x + deleteZoneLayout.width &&
                        currentY >= deleteZoneLayout.y &&
                        currentY <= deleteZoneLayout.y + deleteZoneLayout.height;
                } else {
                    isOverDeleteZone.value = false;
                }
            },
            onEnd: (event) => {
                if (isOverDeleteZone.value) {
                    runOnJS(onDeleteItem)(item.id);
                } else {
                    runOnJS(onPositionUpdate)(item.id, translateX.value, translateY.value);
                }
                isDragging.value = false;
                isOverDeleteZone.value = false;
            },
        }
    );

    const animatedStyle = useAnimatedStyle(() => {
        return {
            position: 'absolute',
            left: translateX.value,
            top: translateY.value,
            zIndex: isDragging.value ? 100 : 10,
            opacity: isDragging.value ? (isOverDeleteZone.value ? 0.5 : 0.8) : 1.0,
            borderWidth: isOverDeleteZone.value ? 2 : 0,
            borderColor: isOverDeleteZone.value ? AppColors.dangerButtonBackground : 'transparent',
            transform: [
                 { scale: isDragging.value ? withSpring(1.05) : withSpring(1.0) },
            ],
        };
    });

    return (
        <PanGestureHandler onGestureEvent={gestureHandler}>
            <Animated.View style={[styles.canvasItem, animatedStyle]}>
                 <Image source={{ uri: item.uri }} style={styles.canvasItemImage} />
            </Animated.View>
        </PanGestureHandler>
    );
};

export default function CollageScreen() {
  const [savedImages, setSavedImages] = useState<SavedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([]);
  const [canvasLayout, setCanvasLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [deleteZoneLayout, setDeleteZoneLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const isItemOverDeleteZone = useSharedValue(false);
  const insets = useSafeAreaInsets();
  const [collageName, setCollageName] = useState<string>('');
  const [isSavingNamed, setIsSavingNamed] = useState<boolean>(false);
  const [imageSearchText, setImageSearchText] = useState('');

  const saveCurrentEditorState = async (itemsToSave: CanvasItem[]) => {
    try {
      await AsyncStorage.setItem(LAST_COLLAGE_STATE_KEY, JSON.stringify(itemsToSave));
    } catch (e) {
      console.error("Failed to auto-save collage state.", e);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setCollageName('');
    try {
      const imagesJsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      const images = imagesJsonValue != null ? JSON.parse(imagesJsonValue) : [];
      images.sort((a: SavedImage, b: SavedImage) => b.timestamp - a.timestamp);
      setSavedImages(images);
      const lastStateJsonValue = await AsyncStorage.getItem(LAST_COLLAGE_STATE_KEY);
      const lastCanvasItems = lastStateJsonValue != null ? JSON.parse(lastStateJsonValue) : [];
      setCanvasItems(lastCanvasItems);
    } catch (e) {
      console.error("Failed to load data from storage", e);
      setError("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    loadData();
  }, []));

  const onCanvasLayout = (event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    setCanvasLayout({ x, y, width, height });
  };

  const handleDropOnCanvas = (item: SavedImage, dropX: number, dropY: number) => {
    const itemWidth = 120;
    const itemHeight = 120;
    const adjustedX = dropX - itemWidth / 2;
    const adjustedY = dropY - itemHeight / 2;
    const newItem: CanvasItem = {
      ...item,
      id: `${item.id}-${Date.now()}`,
      x: adjustedX < 0 ? 0 : adjustedX,
      y: adjustedY < 0 ? 0 : adjustedY,
    };
    setCanvasItems(prevItems => {
      const newItems = [...prevItems, newItem];
      saveCurrentEditorState(newItems);
      return newItems;
    });
  };

  const updateItemPosition = (id: string, newX: number, newY: number) => {
    setCanvasItems(currentItems => {
      const newItems = currentItems.map(item =>
        item.id === id ? { ...item, x: newX, y: newY } : item
      );
      saveCurrentEditorState(newItems);
      return newItems;
    });
  };

  const handleDeleteItem = (id: string) => {
    setCanvasItems(currentItems => {
      const newItems = currentItems.filter(item => item.id !== id);
      saveCurrentEditorState(newItems);
      return newItems;
    });
    console.log("Deleted item:", id);
  };

  const onDeleteZoneLayout = (event: LayoutChangeEvent) => {
    event.target.measure((_x, _y, width, height, pageX, pageY) => {
         setDeleteZoneLayout({ x: pageX, y: pageY, width, height });
         console.log('Delete Zone Layout (screen coords):', { pageX, pageY, width, height });
    });
  };

  const deleteZoneAnimatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
        isItemOverDeleteZone.value ? 1 : 0,
        [0, 1],
        ['#FADADD', '#F08080']
    );
    return {
        backgroundColor,
        transform: [{ scale: isItemOverDeleteZone.value ? withSpring(1.1) : withSpring(1.0) }],
    };
  });

  const clearCurrentCollage = () => {
    Alert.alert("Clear Canvas", "Are you sure you want to remove all items from the canvas?", [{text:"Cancel",style:"cancel"},{text:"Clear",style:"destructive",onPress:async()=>{try{await AsyncStorage.removeItem(LAST_COLLAGE_STATE_KEY);setCanvasItems([]);setCollageName('');}catch(e){Alert.alert("Error","Failed to clear canvas.");}}}]);
  };

  const saveNamedCollage = async () => {
    if (!collageName.trim()) {
        Alert.alert("Name Required", "Please enter a name for your outfit.");
        return;
    }
    if (canvasItems.length === 0) {
         Alert.alert("Empty Canvas", "Add some items to the canvas before saving.");
        return;
    }

    setIsSavingNamed(true);
    try {
        const existingNamedJson = await AsyncStorage.getItem(NAMED_COLLAGES_STORAGE_KEY);
        const namedCollages: NamedCollage[] = existingNamedJson ? JSON.parse(existingNamedJson) : [];

        const newNamedCollage: NamedCollage = {
            id: Crypto.randomUUID(),
            name: collageName.trim(),
            items: canvasItems,
            timestamp: Date.now(),
        };

        namedCollages.push(newNamedCollage);
        await AsyncStorage.setItem(NAMED_COLLAGES_STORAGE_KEY, JSON.stringify(namedCollages));

        Alert.alert("Success",`Outfit "${collageName.trim()}" saved!`);
        setCollageName('');

    } catch (e) {
        console.error("Failed to save named collage", e);
        Alert.alert("Error", "Failed to save outfit.");
    } finally {
         setIsSavingNamed(false);
    }
  };

  const filteredSavedImages = useMemo(() => {
    if (!imageSearchText.trim()) return savedImages;
    return savedImages.filter(img => img.filename.toLowerCase().includes(imageSearchText.toLowerCase()));
  }, [savedImages, imageSearchText]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.pageHeaderContainer}>
        <ThemedText type="title" style={styles.pageTitle}>Collage Studio</ThemedText>
      </View>
      <View style={styles.container}>
        <View style={[styles.panelContainer, styles.topPanel, {padding: 8}]}>
            <View style={styles.controlsSaveContent}>
                <TouchableOpacity onPress={clearCurrentCollage} style={styles.clearCanvasButton}>
                    <Text style={styles.clearCanvasButtonText}>Clear Canvas</Text>
                </TouchableOpacity>
                <View style={styles.saveNamedContainer}>
                        <TextInput
                            style={styles.nameInput}
                            placeholder="Outfit Name"
                            placeholderTextColor={AppColors.secondaryText}
                            value={collageName}
                            onChangeText={setCollageName}
                        />
                        <TouchableOpacity 
                            style={[styles.saveButton, (isSavingNamed || canvasItems.length === 0 || !collageName.trim()) && styles.saveButtonDisabled]}
                            onPress={saveNamedCollage} 
                            disabled={isSavingNamed || canvasItems.length === 0 || !collageName.trim()}
                        >
                            <Text style={styles.saveButtonText}>{isSavingNamed ? "Saving..." : "Save"}</Text>
                        </TouchableOpacity>
                </View>
            </View>
        </View>
        <View style={[styles.panelContainer, styles.middlePanel, {padding: 8}]}>
            <TextInput
                style={styles.imageSearchInput}
                placeholder="Search your items..."
                placeholderTextColor={AppColors.secondaryText}
                value={imageSearchText}
                onChangeText={setImageSearchText}
                clearButtonMode="while-editing"
            />
            {isLoading && <ActivityIndicator size="small" color={AppColors.primaryText} style={{marginVertical: 8}} />}
            {error && <Text style={styles.errorText}>{error}</Text>}
            {!isLoading && !error && filteredSavedImages.length === 0 && (
                <Text style={styles.emptyListText}>
                    {imageSearchText ? `No items found for "${imageSearchText}"` : "No saved items."}
                </Text>
            )}
            {!isLoading && !error && filteredSavedImages.length > 0 && (
                <FlatList
                    data={filteredSavedImages}
                    renderItem={({ item }) => (
                        <DraggableThumbnail item={item} canvasLayout={canvasLayout} onDropOnCanvas={handleDropOnCanvas}/>
                    )}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingVertical: 4 }}
                />
            )}
        </View>
        <View style={styles.canvasContainer} onLayout={onCanvasLayout}>
            {canvasItems.map((item) => (
                 <DraggableCanvasItem
                    key={item.id} item={item} onPositionUpdate={updateItemPosition}
                    onDeleteItem={handleDeleteItem} deleteZoneLayout={deleteZoneLayout}
                    isOverDeleteZone={isItemOverDeleteZone}
                 />
            ))}
            {canvasItems.length === 0 && (
                 <ThemedText style={styles.canvasPlaceholderText}>Drag items here to build your outfit</ThemedText>
            )}
        </View>
        <Animated.View style={[styles.deleteZone, deleteZoneAnimatedStyle, { bottom: 0 } ]} onLayout={onDeleteZoneLayout}>
            <Ionicons name="trash-bin-outline" size={26} color={AppColors.primaryButtonText} />
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  pageHeaderContainer: {
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 10,
    alignItems: 'center',
    backgroundColor: AppColors.screenBackground,
  },
  pageTitle: {
    fontSize: 36,
    color: AppColors.primaryText,
    fontFamily: 'Wasted-Vindey',
    lineHeight: 44,
  },
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: AppColors.screenBackground,
    paddingBottom: 0,
  },
  panelContainer: {
    backgroundColor: AppColors.cardBackground,
    borderRadius: 18,
    marginHorizontal: 15,
    padding: 10,
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 3,
    zIndex: 1,
  },
  topPanel: {
    marginTop: 15,
    marginBottom: 8,
  },
  middlePanel: {
    marginTop: 0,
    marginBottom: 8,
  },
  imageSearchInput: {
    height: 38,
    borderColor: AppColors.inputBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: AppColors.primaryText,
  },
  thumbnailContainer: { marginHorizontal: 4, borderWidth: 1, borderColor: AppColors.inputBorder, borderRadius: 6, padding: 2, backgroundColor: '#FFFFFF', },
  thumbnail: {
    width: 50,
    height: 50,
    resizeMode: 'contain',
  },
  controlsSaveContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  clearCanvasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderRadius: 6,
    gap: 3,
  },
  clearCanvasButtonText: { color: AppColors.dangerButtonBackground, fontSize: 13, fontWeight: '500', },
  saveNamedContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, },
  nameInput: { borderWidth: 1, borderColor: AppColors.inputBorder, borderRadius: 8, paddingVertical: Platform.OS === 'ios' ? 6 : 4, paddingHorizontal: 8, backgroundColor: '#FFFFFF', color: AppColors.primaryText, fontSize: 13, flexShrink: 1, minWidth: 100, },
  saveButton: { backgroundColor: AppColors.primaryButtonBackground, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', },
  saveButtonText: { color: AppColors.primaryButtonText, fontSize: 13, fontWeight: '600', },
  saveButtonDisabled: { backgroundColor: AppColors.buttonDisabledBackground, },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#FCFBF8',
    marginHorizontal: 0,
    position: 'relative',
    overflow: 'hidden',
    marginTop: 8,
  },
  canvasItem: { padding: 3, backgroundColor: 'transparent', borderRadius: 5, shadowColor: AppColors.primaryText, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.20, shadowRadius: 3, elevation: 5, },
  canvasItemImage: { width: 120, height: 120, resizeMode: 'contain', },
  canvasPlaceholderText: { position: 'absolute', width: '100%', top: '45%', fontSize: 16, color: AppColors.secondaryText, textAlign: 'center', },
  errorText: { color: AppColors.errorText, textAlign: 'center', marginTop: 10, backgroundColor: AppColors.errorBackground, padding: 8, borderRadius: 8, marginHorizontal: 10 },
  emptyListText: { textAlign: 'center', marginVertical: 10, color: AppColors.secondaryText, fontSize: 14 },
  deleteZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
}); 

