import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Album, AssetField, Query, getPermissionsAsync, requestPermissionsAsync } from "expo-media-library";
import { ArrowLeft, ImageOff, Search } from "lucide-react-native";
import { Button } from "../../components/atoms/Button";
import { useTranslation } from "../../hooks/useTranslation";
import { loadExcludedAlbums, saveExcludedAlbums } from "../../utils/excludedAlbums";
import { processInBatches } from "../../utils/parallelProcessing";

interface AlbumRow {
  id: string;
  title: string;
  /** iOS system album (Selfies, Favorites, Screenshots…). */
  system?: boolean;
}

interface AlbumDetails {
  count: number;
  /** Library id of the most recent photo or video, used as the cover. */
  coverId: string | null;
}

/** Details are loaded a few albums at a time, in the background. */
const DETAILS_CONCURRENCY = 4;
const SAVE_DELAY_MS = 400;

type Permission = "unknown" | "granted" | "denied";

/**
 * Lets the player choose which albums the game may pick from. Albums show up
 * immediately; counts and covers fill in afterwards.
 */
export function AlbumExclusions({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [permission, setPermission] = useState<Permission>("unknown");
  const [albums, setAlbums] = useState<AlbumRow[] | null>(null);
  const [details, setDetails] = useState<Record<string, AlbumDetails>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  // ── Exclusions: saved shortly after the last change, and when leaving ──
  const excludedRef = useRef(excluded);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    loadExcludedAlbums().then((set) => {
      excludedRef.current = set;
      setExcluded(set);
    });
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveExcludedAlbums(excludedRef.current);
      }
    };
  }, []);

  const updateExcluded = useCallback((next: Set<string>) => {
    excludedRef.current = next;
    setExcluded(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveExcludedAlbums(next);
    }, SAVE_DELAY_MS);
  }, []);

  // ── Albums ──
  const loadAlbums = useCallback(async () => {
    let { status } = await getPermissionsAsync();
    if (status !== "granted") status = (await requestPermissionsAsync()).status;
    if (status !== "granted") {
      setPermission("denied");
      return;
    }
    setPermission("granted");

    const metadata = await Album.getAlbumsMetadata().catch(() => []);
    const userRows: AlbumRow[] = metadata
      .map((album) => ({ id: album.id, title: album.title || "" }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
    const systemRows = await loadSystemAlbums();
    const rows = [...userRows, ...systemRows];
    setAlbums(rows);

    // Counts and covers: in the background, applied in small batches.
    let pending: Record<string, AlbumDetails> = {};
    const flush = () => {
      const batch = pending;
      pending = {};
      if (Object.keys(batch).length) setDetails((prev) => ({ ...prev, ...batch }));
    };
    const flushTimer = setInterval(flush, 250);
    await processInBatches(
      rows,
      async (row) => {
        const album = new Album(row.id);
        const [count, cover] = await Promise.all([
          album.getAssetCount().catch(() => 0),
          new Query()
            .album(album)
            .orderBy({ key: AssetField.CREATION_TIME, ascending: false })
            .limit(1)
            .exeForMetadata()
            .catch(() => []),
        ]);
        pending[row.id] = { count, coverId: cover[0]?.id ?? null };
      },
      DETAILS_CONCURRENCY
    );
    clearInterval(flushTimer);
    flush();
  }, []);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (albums ?? []).filter((a) => !q || a.title.toLowerCase().includes(q));
  }, [albums, query]);

  const toggle = useCallback(
    (id: string) => {
      const next = new Set(excludedRef.current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      updateExcluded(next);
    },
    [updateExcluded]
  );

  /** Applies to the albums shown (all of them, or the search results). */
  const setAllVisible = (exclude: boolean) => {
    const next = new Set(excludedRef.current);
    visible.forEach((a) => (exclude ? next.add(a.id) : next.delete(a.id)));
    updateExcluded(next);
  };

  const excludedCount = (albums ?? []).filter((a) => excluded.has(a.id)).length;

  const firstSystemIndex = visible.findIndex((a) => a.system);

  const header = (
    <View className="px-5" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center mb-4">
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t("common.goBack")}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 items-center justify-center mr-3"
        >
          <ArrowLeft size={20} color="#ffffff" />
        </Pressable>
        <Text className="text-white text-2xl font-bold flex-1">{t("albums.title")}</Text>
      </View>
      <Text className="text-gray-400 text-sm mb-4">{t("albums.explanation")}</Text>
    </View>
  );

  if (permission === "denied") {
    return (
      <View className="flex-1 bg-black">
        {header}
        <View className="bg-gray-900 rounded-2xl p-4 mx-5">
          <Text className="text-gray-300 text-sm mb-3">{t("settings.permissionExplanation")}</Text>
          <Button title={t("settings.grantPermission")} onPress={loadAlbums} variant="primary" />
        </View>
      </View>
    );
  }

  if (albums === null) {
    return (
      <View className="flex-1 bg-black">
        {header}
        <View className="items-center mt-10">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-gray-400 text-sm mt-3">{t("settings.loadingAlbums")}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {header}
      {albums.length > 0 && (
      <View className="px-5">
        <Text className="text-white text-base font-semibold mb-3" accessibilityLiveRegion="polite">
          {excludedCount === 0
            ? t("albums.allUsed")
            : t("albums.summary", { excluded: excludedCount, total: albums.length })}
        </Text>
        <View className="flex-row items-center bg-gray-900 border border-gray-800 rounded-xl px-3 mb-3">
          <Search size={18} color="#9ca3af" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("albums.search")}
            placeholderTextColor="#6b7280"
            autoCorrect={false}
            clearButtonMode="while-editing"
            className="flex-1 text-white text-base py-3 ml-2"
          />
        </View>
        <View className="flex-row gap-2 mb-3">
          <Pressable
            onPress={() => setAllVisible(false)}
            accessibilityRole="button"
            className="flex-1 py-2.5 rounded-xl bg-gray-800 items-center active:opacity-70"
          >
            <Text className="text-white text-sm font-semibold">{t("albums.useAll")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setAllVisible(true)}
            accessibilityRole="button"
            className="flex-1 py-2.5 rounded-xl bg-gray-800 items-center active:opacity-70"
          >
            <Text className="text-white text-sm font-semibold">{t("albums.excludeAll")}</Text>
          </Pressable>
        </View>
      </View>
      )}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <>
          {index === firstSystemIndex && (
            <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider px-5 pt-5 pb-2">
              {t("albums.systemAlbums")}
            </Text>
          )}
          <AlbumItem
            album={item}
            details={details[item.id]}
            used={!excluded.has(item.id)}
            onToggle={toggle}
            untitled={t("settings.untitledAlbum")}
            itemsLabel={t("settings.itemsLabel")}
          />
          </>
        )}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-900 ml-20" />}
        ListEmptyComponent={
          <Text className="text-gray-500 text-center mt-8">
            {albums.length === 0 ? t("settings.noAlbums") : t("albums.noResults")}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        windowSize={7}
      />
    </View>
  );
}

/**
 * iOS system albums (Selfies, Favorites, Screenshots…), without the empty ones
 * and without the one holding the whole library (Recents): excluding it would
 * exclude everything.
 */
async function loadSystemAlbums(): Promise<AlbumRow[]> {
  if (Platform.OS !== "ios") return [];
  const smart = await Album.getSmartAlbums().catch(() => [] as Album[]);
  const rows = await Promise.all(
    smart.map(async (album) => ({
      id: album.id,
      title: await album.getTitle().catch(() => ""),
      count: await album.getAssetCount().catch(() => 0),
    }))
  );
  const largest = Math.max(0, ...rows.map((r) => r.count));
  return rows
    .filter((r) => r.title && r.count > 0 && r.count < largest)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
    .map(({ id, title }) => ({ id, title, system: true }));
}

const AlbumItem = memo(function AlbumItem({
  album,
  details,
  used,
  onToggle,
  untitled,
  itemsLabel,
}: {
  album: AlbumRow;
  details?: AlbumDetails;
  used: boolean;
  onToggle: (id: string) => void;
  untitled: string;
  itemsLabel: string;
}) {
  const title = album.title || untitled;
  return (
    <Pressable
      onPress={() => onToggle(album.id)}
      accessibilityRole="switch"
      accessibilityState={{ checked: used }}
      accessibilityLabel={title}
      className="flex-row items-center px-5 py-3 active:bg-gray-900"
    >
      <View className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 items-center justify-center mr-3">
        {details?.coverId ? (
          <Image
            source={{ uri: details.coverId }}
            style={{ width: 48, height: 48, opacity: used ? 1 : 0.35 }}
            contentFit="cover"
            recyclingKey={details.coverId}
            transition={100}
          />
        ) : (
          <ImageOff size={18} color="#4b5563" />
        )}
      </View>
      <View className="flex-1 mr-3">
        <Text className={`text-base font-medium ${used ? "text-white" : "text-gray-500"}`} numberOfLines={1}>
          {title}
        </Text>
        <Text className="text-gray-500 text-xs mt-0.5">
          {details ? `${details.count} ${itemsLabel}` : " "}
        </Text>
      </View>
      <Switch
        value={used}
        onValueChange={() => onToggle(album.id)}
        trackColor={{ true: "#f97316", false: "#374151" }}
        ios_backgroundColor="#374151"
      />
    </Pressable>
  );
});
