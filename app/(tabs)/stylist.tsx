import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Linking, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { SavedImage, NamedCollage, CanvasItem } from '@/types/collage'; // Assuming types are here
import CollagePreview from '@/components/CollagePreview'; // ADDED: Import shared CollagePreview
import { AppColors } from '@/constants/Colors';

// TODO: Import a CollagePreview component if available and suitable, or define a simple one.
// For now, we'll use a placeholder.

// ADDED: Your Flask server's URL for the weather endpoint
const FLASK_WEATHER_ENDPOINT = 'http://10.0.0.81:5000/api/get_weather'; // Ensure this matches your Flask server address

// Placeholder for actual collage preview - might need to be imported or adapted
// const CollagePreviewPlaceholder = ({ items, size }: { items: CanvasItem[], size: number }) => {
//   if (!items || items.length === 0) {
//     return (
//       <View style={[styles.collagePreview, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
//         <Text style={styles.placeholderText}>No outfit generated yet.</Text>
//       </View>
//     );
//   }
//   // In a real scenario, this would render images similar to HomeScreen's CollagePreview
//   return (
//     <View style={[styles.collagePreview, { width: size, height: size, justifyContent: 'center', alignItems: 'center'}]}>
//       <Text style={styles.placeholderText}>{items.length} item(s) in outfit</Text>
//       {/* Basic rendering for now */}
//       {items.map(item => <Text key={item.id} style={{fontSize: 10}}>{item.filename}</Text>)}
//     </View>
//   );
// };


export default function AiStylistScreen() {
  const [weather, setWeather] = useState<any>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);
  const [isLoadingOutfit, setIsLoadingOutfit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [suggestedOutfit, setSuggestedOutfit] = useState<NamedCollage | null>(null);
  const [userGallery, setUserGallery] = useState<SavedImage[]>([]);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState<Location.PermissionStatus | null>(null);

  // Fetch user's clothing gallery
  const loadUserGallery = async () => {
    try {
      const galleryJson = await AsyncStorage.getItem('@StyleIt/SavedImages');
      const gallery: SavedImage[] = galleryJson ? JSON.parse(galleryJson) : [];
      setUserGallery(gallery);
    } catch (e) {
      console.error("Failed to load user gallery for stylist:", e);
      setError("Could not load your clothing gallery.");
    }
  };

  const fetchWeather = async (latitude: number, longitude: number) => {
    if (isLoadingWeather && weather) return;
    setIsLoadingWeather(true);
    try {
      const response = await fetch(`${FLASK_WEATHER_ENDPOINT}?lat=${latitude}&lon=${longitude}`);
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        console.error("Failed to parse weather response as JSON:", responseText);
        throw new Error(`Server returned non-JSON response: ${response.status} - ${responseText.substring(0, 100)}`);
      }
      if (!response.ok) {
        const errorMessage = data.error || data.details || `Error from weather service: ${response.status}`;
        throw new Error(errorMessage);
      }
      setWeather(data);
      setLocationError(null);
    } catch (e: any) {
      console.error("Failed to fetch weather via Flask server:", e);
      setError("Weather data could not be updated: " + e.message);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const getLocationAndWeather = async () => {
    setLocationError(null);
    setError(null);
    setIsLoadingWeather(true);

    let { status } = await Location.requestForegroundPermissionsAsync();
    setLocationPermissionStatus(status);

    if (status !== 'granted') {
      setLocationError(
        'Permission to access location was denied. Please enable it in settings to get local weather. Using default weather data.'
      );
      console.log("Location permission denied. Fetching default weather.");
      await fetchWeather(51.5074, 0.1278);
      setIsLoadingWeather(false);
      return;
    }

    try {
      const locationPromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Location request timed out.")), 10000)
      );

      const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      
      if (location && location.coords) {
        await fetchWeather(location.coords.latitude, location.coords.longitude);
      } else {
        throw new Error("Could not retrieve location coordinates.");
      }
    } catch (e: any) {
      console.warn("Error getting location or timeout: ", e.message);
      setLocationError("Could not get current location: " + e.message + ". Using default weather.");
      await fetchWeather(51.5074, 0.1278);
    } finally {
      setIsLoadingWeather(false);
    }
  };
  
  useFocusEffect(
    useCallback(() => {
      loadUserGallery();
      getLocationAndWeather();
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  const handleSuggestOutfit = async () => {
    setIsLoadingOutfit(true);
    setError(null);
    setSuggestedOutfit(null);

    if (!weather || !weather.main || !weather.weather || !weather.weather[0]) {
      setError("Weather data is incomplete or not available. Cannot suggest outfit.");
      Alert.alert("Missing Data", "Weather data not available or incomplete. Please try again after weather has loaded.");
      setIsLoadingOutfit(false);
      return;
    }

    if (userGallery.length === 0) {
      setError("Your gallery is empty. Add some clothes first!");
      Alert.alert("Empty Gallery", "Please add some clothing items to your gallery before using the stylist.");
      setIsLoadingOutfit(false);
      return;
    }

    // Filter gallery for items with essential metadata
    const usableGallery = userGallery.filter(item => item.category && item.warmth);
    if (usableGallery.length === 0) {
      setError("None of your saved clothes have category and warmth information. Please update them in the gallery to use the stylist.");
      Alert.alert("Missing Item Info", "Please add category and warmth details to your clothes in the gallery.");
      setIsLoadingOutfit(false);
      return;
    }

    try {
      const temperature = weather.main.temp; // Celsius
      const mainCondition = weather.weather[0].main; // e.g., "Rain", "Clear", "Clouds"
      // const conditionDescription = weather.weather[0].description;

      let preferredWarmth: SavedImage['warmth'] = 'medium';
      if (temperature < 10) preferredWarmth = 'warm';
      else if (temperature > 20) preferredWarmth = 'light';

      const isRainingOrSnowing = ["Rain", "Snow", "Drizzle", "Thunderstorm"].includes(mainCondition);

      let availableItems = [...usableGallery]; // Create a mutable copy
      const outfitItems: CanvasItem[] = [];
      let selectedItemIds = new Set<string>(); // Keep track of selected item IDs

      const selectItem = (
        category: SavedImage['category'],
        targetWarmth: SavedImage['warmth'] | SavedImage['warmth'][],
        isOptional: boolean = false
      ): SavedImage | null => {
        const warmthArray = Array.isArray(targetWarmth) ? targetWarmth : [targetWarmth];
        for (let i = 0; i < availableItems.length; i++) {
          const item = availableItems[i];
          if (
            !selectedItemIds.has(item.id) &&
            item.category === category &&
            item.warmth && // Ensure warmth is defined
            warmthArray.includes(item.warmth)
          ) {
            selectedItemIds.add(item.id); // Mark as used
            return item;
          }
        }
        return null;
      };
      
      // Define placeholder X, Y coordinates for collage items
      // These would ideally be dynamically calculated for better layout
      const itemPositions = [
          { x: 50, y: 50 },
          { x: 50, y: 180 },
          { x: 50, y: 310 },
          { x: 180, y: 50 },
          { x: 180, y: 180 },
      ];
      let currentPositionIndex = 0;
      const getNextPosition = () => {
          const pos = itemPositions[currentPositionIndex % itemPositions.length];
          currentPositionIndex++;
          return pos;
      };


      // 1. Try for a 'fullbody' item
      let fullBodyItem = selectItem('fullbody', preferredWarmth);
      if (fullBodyItem) {
        outfitItems.push({ ...fullBodyItem, ...getNextPosition() });
      } else {
        // 2. If no 'fullbody', try for 'top' and 'bottom'
        const topItem = selectItem('top', preferredWarmth);
        if (topItem) {
          outfitItems.push({ ...topItem, ...getNextPosition() });
        }

        const bottomItem = selectItem('bottom', preferredWarmth);
        if (bottomItem) {
          outfitItems.push({ ...bottomItem, ...getNextPosition() });
        }

        // Check if base layer is insufficient
        if (!topItem && !bottomItem) {
            // If after trying fullbody, and top/bottom, we still have nothing foundational
             setError(`Could not find a suitable base layer (full-body, top, or bottom) for the current weather (Temp: ${temperature}°C, Preferred Warmth: ${preferredWarmth}).`);
             setIsLoadingOutfit(false);
             return;
        } else if (!topItem && fullBodyItem === null /* ensure we didn't pick fullbody */) {
            setError(`Found a bottom, but no matching top for current weather (Temp: ${temperature}°C, Preferred Warmth: ${preferredWarmth}).`);
             // We might proceed with just a bottom, or decide it's not a valid outfit
        } else if (!bottomItem && fullBodyItem === null) {
            setError(`Found a top, but no matching bottom for current weather (Temp: ${temperature}°C, Preferred Warmth: ${preferredWarmth}).`);
            // Similar to above
        }
      }
      
      // 3. Outerwear
      const needsOuterwear = temperature < 15 || isRainingOrSnowing;
      if (needsOuterwear) {
        let outerwearWarmthTarget: SavedImage['warmth'][] = [preferredWarmth];
        if (temperature < 5) outerwearWarmthTarget = ['warm']; // Very cold, only 'warm' outerwear
        else if (temperature < 10) outerwearWarmthTarget = ['warm', 'medium']; // Cold
        else if (isRainingOrSnowing && temperature >= 10) outerwearWarmthTarget = ['light', 'medium']; // Mild but wet
        else if (temperature < 15) outerwearWarmthTarget = ['medium', 'light']; // Cool

        const outerwearItem = selectItem('outerwear', outerwearWarmthTarget);
        if (outerwearItem) {
          outfitItems.push({ ...outerwearItem, ...getNextPosition() });
        } else {
          // Optional: Add a note if outerwear was needed but not found
          const currentError = error ? error + "\n" : "";
          setError(currentError + `Consider adding/tagging an outerwear item suitable for these conditions (Temp: ${temperature}°C, Rain/Snow: ${isRainingOrSnowing}).`);
        }
      }

      // 4. Footwear (Optional - can be expanded)
      const footwearItem = selectItem('footwear', preferredWarmth, true);
      if (footwearItem) {
        outfitItems.push({ ...footwearItem, ...getNextPosition() });
      }

      // 5. Accessory (Optional - can be expanded)
      const accessoryItem = selectItem('accessory', ['light', 'medium', 'warm'], true); // Accessories often less warmth-critical
      if (accessoryItem) {
        outfitItems.push({ ...accessoryItem, ...getNextPosition() });
      }
      

      if (outfitItems.length > 0) {
        // Clear partial errors if a valid outfit is formed
        if (error && outfitItems.find(item => item.category === 'top' || item.category === 'bottom' || item.category === 'fullbody')) {
            // If we have a base, but had minor errors (like missing outerwear), we might clear some errors
            // This logic needs to be more nuanced. For now, if an outfit is formed, we primarily set the outfit.
            // If a critical piece was missing that led to an early return, that error stands.
            // If an optional piece (like outerwear) was just noted as missing, but we have a base, that's okay.
            // Let's assume for now if outfitItems.length > 0, previous non-critical errors can be overridden by success.
             if(!(error && error.includes("Could not find a suitable base layer"))) {
                setError(null); // Clear non-critical errors if we have a base outfit
             }
        }


        setSuggestedOutfit({
          id: `ai-outfit-${Date.now()}`,
          name: `Suggested Outfit (${new Date().toLocaleDateString()})`,
          items: outfitItems,
          timestamp: Date.now(),
        });
      } else if (!error) { // If no items were added AND no specific error was set before (e.g. base layer missing)
        setError(`Could not form an outfit with the available items for current weather (Temp: ${temperature}°C, Preferred Warmth: ${preferredWarmth}). Try adjusting your gallery or item tags.`);
      }
      // If an error was set (e.g. "base layer missing"), it will persist.

    } catch (e: any) {
      console.error("Outfit suggestion error:", e);
      setError("An unexpected error occurred while generating the outfit: " + e.message);
    } finally {
      setIsLoadingOutfit(false);
    }
  };

  return (
    <ScrollView style={styles.scrollViewContainer}>
      <View style={styles.headerTitleContainer}>
        <ThemedText type="title" style={styles.headerTitleText}>Stylist</ThemedText>
      </View>

      <View style={styles.contentContainer}>
        {locationError && (
          <View style={styles.errorAlertContainer}>
            <Text style={styles.errorAlertText}>{locationError}</Text>
            {locationPermissionStatus !== 'granted' && Platform.OS !== 'web' && (
              <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.settingsButton}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>Current Conditions</ThemedText>
          {isLoadingWeather && <ActivityIndicator size="large" color={AppColors.primaryText} style={{ marginVertical: 20 }}/>}
          {weather && !isLoadingWeather && (
            <View style={styles.weatherDetailsContainer}>
              <Text style={styles.weatherDetailText}>Location: <Text style={styles.weatherValueText}>{weather.name}</Text></Text>
              <Text style={styles.weatherDetailText}>Temperature: <Text style={styles.weatherValueText}>{weather.main.temp}°C</Text></Text>
              <Text style={styles.weatherDetailText}>Condition: <Text style={styles.weatherValueText}>{weather.weather[0].description}</Text></Text>
            </View>
          )}
          {!weather && !isLoadingWeather && !locationError && <Text style={styles.infoText}>Weather data unavailable.</Text>}
        </View>
        
        <View style={styles.actionButtonContainer}>
          <TouchableOpacity 
              style={[styles.buttonPrimary, (isLoadingOutfit || isLoadingWeather || !weather) && styles.buttonDisabled]} 
              onPress={handleSuggestOutfit}
              disabled={isLoadingOutfit || isLoadingWeather || !weather}
            >
            <Text style={styles.buttonPrimaryText}>
              {isLoadingOutfit ? "Thinking..." : "Suggest Outfit"}
            </Text>
          </TouchableOpacity>
        </View>

        {error && !locationError && (
           <View style={styles.errorAlertContainer}>
            <Text style={styles.errorAlertText}>{error}</Text>
          </View>
        )}

        {isLoadingOutfit && (
          <View style={styles.loadingContainer}> 
            <ActivityIndicator size="large" color={AppColors.primaryText} />
            <Text style={styles.loadingText}>Finding the perfect look...</Text>
          </View>
        )}
        {suggestedOutfit && !isLoadingOutfit && (
          <View style={styles.sectionContainer}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Suggested Outfit</ThemedText>
            <View style={styles.collagePreviewWrapper}>
              <CollagePreview
                items={suggestedOutfit.items}
                size={300}
                backgroundColor={AppColors.inputBackground}
              />
            </View>
            {/* TODO: Add options to save or reshuffle the outfit */}
          </View>
        )}
        {!suggestedOutfit && !isLoadingOutfit && !error && (
          <View style={styles.sectionContainer}> 
            <ThemedText type="subtitle" style={styles.sectionTitle}>Suggested Outfit</ThemedText>
            <View style={styles.collagePreviewWrapper}>
                <CollagePreview items={[]} size={300} backgroundColor={AppColors.inputBackground} />
            </View>
          </View>
        )}
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
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
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
  contentContainer: {
    paddingHorizontal: 15,
    paddingBottom: 30,
  },
  sectionContainer: {
    gap: 12,
    marginBottom: 25,
    padding: 20,
    backgroundColor: AppColors.cardBackground,
    borderRadius: 25,
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: AppColors.primaryText,
    textAlign: 'center',
    marginBottom: 10,
  },
  weatherDetailsContainer: {
    marginTop: 10,
    padding: 15,
    backgroundColor: AppColors.inputBackground,
    borderRadius: 12,
    width: '100%',
    alignItems: 'flex-start',
    gap: 8,
  },
  weatherDetailText: {
    fontSize: 16,
    color: AppColors.secondaryText,
  },
  weatherValueText: {
    fontWeight: '600',
    color: AppColors.primaryText,
  },
  infoText: {
    fontSize: 14,
    color: AppColors.secondaryText,
    textAlign: 'center',
    paddingVertical: 10,
  },
  actionButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: AppColors.primaryButtonBackground,
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    width: '90%',
    maxWidth: 380,
    alignSelf: 'center',
    elevation: 2,
    shadowColor: AppColors.primaryText,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonPrimaryText: {
    color: AppColors.primaryButtonText,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: AppColors.buttonDisabledBackground,
    shadowOpacity: 0,
    elevation: 0,
  },
  errorAlertContainer: {
    backgroundColor: AppColors.errorBackground,
    padding: 15,
    borderRadius: 12,
    marginVertical: 10,
    marginHorizontal: 0,
    alignItems: 'center',
  },
  errorAlertText: {
    color: AppColors.errorText,
    textAlign: 'center',
    fontSize: 15,
    marginBottom: Platform.OS === 'web' ? 0 : 5,
  },
  settingsButton: {
    backgroundColor: AppColors.primaryButtonBackground,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginTop: 10,
  },
  settingsButtonText: {
    color: AppColors.primaryButtonText,
    fontSize: 13,
    fontWeight: '500',
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
  collagePreviewWrapper: {
    alignItems: 'center',
    marginVertical: 10,
    width: '100%',
    backgroundColor: AppColors.inputBackground,
    borderRadius: 12,
    padding: 10,
  },
}); 
