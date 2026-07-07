/**
 * screens/CollectionDetailScreen.js
 * Zeigt alle Rezepte einer Sammlung mit großen Thumbnails.
 * route.params: { collectionId, collectionName }
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, ScrollView,
  ActivityIndicator, Alert, StyleSheet, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useStore } from '../store';
import { useTheme } from '../theme';
import { getDisplayTime } from '../utils/time';
import { api, getBaseUrl } from '../api/client';

export default function CollectionDetailScreen({ route, navigation }) {
  const { colors: C, spacing: S, radius: R, type: T } = useTheme();
  const insets = useSafeAreaInsets();
  const { collectionId, collectionName } = route.params;
  const { removeFromCollection, collections, addToCollection } = useStore();

  const [collectionRecipes, setCollectionRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moveModal, setMoveModal] = useState(false);
  const [moveRecipe, setMoveRecipe] = useState(null);
  const [moveLoading, setMoveLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCollectionRecipes(collectionId);
      setCollectionRecipes(data);
    } catch (e) {
      Alert.alert('Fehler', e.message);
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (recipeId) => {
    await removeFromCollection(collectionId, recipeId);
    setCollectionRecipes(prev => prev.filter(r => r.id !== recipeId));
  };

  const handleMove = async (targetCollectionId) => {
    if (!moveRecipe) return;
    setMoveLoading(true);
    try {
      await addToCollection(targetCollectionId, moveRecipe.id);
      await removeFromCollection(collectionId, moveRecipe.id);
      setCollectionRecipes(prev => prev.filter(r => r.id !== moveRecipe.id));
      setMoveModal(false);
    } catch (e) { Alert.alert('Fehler', e.message); }
    setMoveLoading(false);
  };

  const renderRecipe = ({ item }) => {
    const imageUrl = item.image_path ? `${getBaseUrl()}${item.image_path}` : null;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: C.surface }]}
        onPress={() => navigation.navigate('RecipeDetail', { recipeId: item.id })}
        activeOpacity={0.85}
      >
        {/* Thumbnail */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: C.bgSecondary }]}>
              <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={{ flex: 1 }}>
            <Text style={[T.bodyMed, { color: C.text }]} numberOfLines={2}>
              {item.emoji} {item.name}
            </Text>
            {item.prep_time ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Feather name="clock" size={11} color={C.textTertiary} />
                <Text style={[T.caption, { color: C.textTertiary }]}>{getDisplayTime(item.prep_time)}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => { setMoveRecipe(item); setMoveModal(true); }}
            hitSlop={10} style={{ padding: 4 }}
          >
            <Feather name="folder" size={17} color={C.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={10} style={{ padding: 4 }}>
            <Feather name="x" size={18} color={C.textTertiary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const otherCollections = collections.filter(c => c.id !== collectionId);

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="arrow-left" size={18} color={C.text} />
        </TouchableOpacity>
        <Text style={[T.h3, { color: C.text, flex: 1, marginLeft: S.sm }]} numberOfLines={1}>{collectionName}</Text>
        <Text style={[T.caption, { color: C.textTertiary }]}>{collectionRecipes.length} Rezepte</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={C.accent} />
      ) : (
        <FlatList
          data={collectionRecipes}
          keyExtractor={i => i.id.toString()}
          renderItem={renderRecipe}
          contentContainerStyle={{ padding: S.md, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80, gap: 12 }}>
              <Feather name="bookmark" size={40} color={C.border} />
              <Text style={[T.body, { color: C.textTertiary }]}>Noch keine Rezepte in dieser Sammlung</Text>
            </View>
          }
        />
      )}

      {/* Verschieben Modal */}
      <Modal visible={moveModal} transparent animationType="slide" onRequestClose={() => setMoveModal(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setMoveModal(false)} />
        <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 16, maxHeight: '60%' }}>
          <View style={{ width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border }}>
            <Feather name="folder" size={16} color={C.accent} style={{ marginRight: 8 }} />
            <Text style={[T.bodyMed, { color: C.text, flex: 1 }]} numberOfLines={1}>
              {moveRecipe?.name || 'Verschieben'}
            </Text>
            <TouchableOpacity onPress={() => setMoveModal(false)} hitSlop={10}>
              <Feather name="x" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
            {/* Unsortiert option */}
            <TouchableOpacity
              disabled={moveLoading}
              onPress={async () => {
                setMoveLoading(true);
                try {
                  await removeFromCollection(collectionId, moveRecipe.id);
                  setCollectionRecipes(prev => prev.filter(r => r.id !== moveRecipe.id));
                  setMoveModal(false);
                } catch (e) { Alert.alert('Fehler', e.message); }
                setMoveLoading(false);
              }}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, gap: 12 }}
            >
              <Feather name="inbox" size={18} color={C.textSecondary} />
              <Text style={[T.body, { color: C.text, flex: 1 }]}>Unsortiert</Text>
              {moveLoading ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="chevron-right" size={16} color={C.textTertiary} />}
            </TouchableOpacity>
            {otherCollections.map(col => (
              <TouchableOpacity
                key={col.id}
                disabled={moveLoading}
                onPress={() => handleMove(col.id)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: C.surface, borderRadius: R.md, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, gap: 12 }}
              >
                <Feather name="folder" size={18} color={C.accent} />
                <Text style={[T.body, { color: C.text, flex: 1 }]}>{col.name}</Text>
                {moveLoading ? <ActivityIndicator size="small" color={C.accent} /> : <Feather name="chevron-right" size={16} color={C.textTertiary} />}
              </TouchableOpacity>
            ))}
            {otherCollections.length === 0 && (
              <Text style={[T.caption, { color: C.textSecondary, textAlign: 'center', paddingVertical: 12 }]}>
                Keine anderen Sammlungen vorhanden
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  imageContainer: { width: '100%', height: 200 },
  image: { width: '100%', height: '100%', resizeMode: 'cover' },
  imagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 72, height: 72, opacity: 0.4 },
  cardInfo: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
});
