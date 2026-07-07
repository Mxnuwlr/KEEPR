/**
 * DrumRollPicker.js — Scroll-basierter Auswahl-Picker (iOS-Drum-Roll-Style)
 *
 * Zeigt 5 Elemente gleichzeitig, das mittlere ist ausgewählt (highlight mit Rahmen).
 * Snapped-Scrolling: einrasten an ITEM_HEIGHT-Intervallen.
 * Keine externe Library — reines FlatList mit snapToInterval.
 *
 * Props:
 *   values         {Array}     — Werte-Liste (any, toString() für Anzeige)
 *   selectedValue  {any}       — Aktuell ausgewählter Wert
 *   onValueChange  {function}  — Callback(newValue) bei Änderung
 */

// React/RN
import React, { useRef, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;

export default function DrumRollPicker({ values, selectedValue, onValueChange }) {
  const listRef = useRef(null);
  const selectedIndex = values.indexOf(selectedValue);

  useEffect(() => {
    if (listRef.current && selectedIndex >= 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: selectedIndex, animated: false, viewPosition: 0.5 });
      }, 100);
    }
  }, [selectedValue]);

  const handleScroll = (e) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
    if (values[clampedIndex] !== selectedValue) {
      onValueChange(values[clampedIndex]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.highlight} pointerEvents="none" />
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(item) => item.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
        getItemLayout={(_, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
        ListHeaderComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
        ListFooterComponent={<View style={{ height: ITEM_HEIGHT * 2 }} />}
        renderItem={({ item }) => {
          const isSelected = item === selectedValue;
          return (
            <View style={styles.item}>
              <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                {item.toString()}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: ITEM_HEIGHT * VISIBLE_ITEMS, overflow: 'hidden', flex: 1 },
  highlight: { position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0, height: ITEM_HEIGHT, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#e8c547', zIndex: 1 },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemText: { color: '#444', fontSize: 17 },
  itemTextSelected: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
});
