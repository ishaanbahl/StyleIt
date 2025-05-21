import React from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { CanvasItem } from '@/types/collage'; // Assuming CanvasItem is in this path

interface CollagePreviewProps {
  items: CanvasItem[];
  size: number;
  backgroundColor?: string;
}

const CollagePreview = ({ items, size, backgroundColor = '#e0e0e0' }: CollagePreviewProps) => {
  if (!items || items.length === 0) {
    return (
      <View 
        style={[
          styles.previewBase,
          { 
            width: size, 
            height: size, 
            backgroundColor: backgroundColor,
            justifyContent: 'center', 
            alignItems: 'center' 
          }
        ]}
      >
        {/* Optionally, show a placeholder icon or text for empty/no collage */}
      </View>
    );
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  // These could be passed as props if items can have variable default sizes
  const defaultItemWidth = 120; 
  const defaultItemHeight = 120;

  items.forEach(item => {
    const itemRenderWidth = item.width || defaultItemWidth; // Use actual item width if available
    const itemRenderHeight = item.height || defaultItemHeight; // Use actual item height if available
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + itemRenderWidth);
    maxY = Math.max(maxY, item.y + itemRenderHeight);
  });

  if (items.length > 0 && (maxX <= minX || maxY <= minY)) { 
      if (items.length === 1) { 
          minX = items[0].x;
          minY = items[0].y;
          maxX = items[0].x + (items[0].width || defaultItemWidth);
          maxY = items[0].y + (items[0].height || defaultItemHeight);
      } else { 
         maxX = minX + defaultItemWidth;
         maxY = minY + defaultItemHeight;
      }
  } else if (items.length === 0) { 
      minX = 0; minY = 0; maxX = defaultItemWidth; maxY = defaultItemHeight;
  }

  const originalContentWidth = Math.max(1, maxX - minX); 
  const originalContentHeight = Math.max(1, maxY - minY); 

  const scaleX = size / originalContentWidth;
  const scaleY = size / originalContentHeight;
  const scale = Math.min(scaleX, scaleY, 1); 

  return (
    <View 
      style={[
        styles.previewBase,
        {
          width: size, 
          height: size, 
          backgroundColor: backgroundColor,
          position: 'relative' 
        }
      ]}
    >
      {items.map((item) => {
        const itemRenderWidth = (item.width || defaultItemWidth) * scale;
        const itemRenderHeight = (item.height || defaultItemHeight) * scale;
        const scaledItemX = (item.x - minX) * scale;
        const scaledItemY = (item.y - minY) * scale;

        if (scaledItemX + itemRenderWidth <= 0 || scaledItemY + itemRenderHeight <= 0 || scaledItemX >= size || scaledItemY >= size) {
          return null;
        }

        return (
          <Image
            key={item.id}
            source={{ uri: item.uri }}
            style={{
              position: 'absolute',
              left: scaledItemX,
              top: scaledItemY,
              width: itemRenderWidth,
              height: itemRenderHeight,
              resizeMode: 'contain', // Default resizeMode, can be prop if needed
            }}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  previewBase: {
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default CollagePreview; 
