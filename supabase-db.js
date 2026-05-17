(function () {
  const config = window.JARITNYANG_SUPABASE || {};
  const isConfigured = Boolean(config.url && config.anonKey && window.supabase);
  const client = isConfigured ? window.supabase.createClient(config.url, config.anonKey) : null;

  function getClient() {
    return client;
  }

  async function getCurrentUser() {
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user || null;
  }

  async function signInWithOtp({ email, phone }) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    if (email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      return;
    }

    const { error } = await client.auth.signInWithOtp({ phone });
    if (error) throw error;
  }

  async function signInWithOAuth(provider) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  function onAuthStateChange(callback) {
    if (!client) return null;
    const { data } = client.auth.onAuthStateChange(callback);
    return data?.subscription || null;
  }

  async function upsertProfile(user, displayName) {
    if (!client || !user) return;
    const provider = user.app_metadata?.provider || (user.phone ? "phone" : "email");
    const { error } = await client.from("profiles").upsert({
      id: user.id,
      display_name: displayName || user.user_metadata?.name || user.email || user.phone || "Jaritnyang user",
      auth_method: provider,
      phone: user.phone || null,
    });
    if (error) console.warn("Profile sync failed", error);
  }

  async function updateProfile({ displayName }) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const user = await getCurrentUser();
    if (!user) throw new Error("LOGIN_REQUIRED");
    const { data, error } = await client
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function loadAccountData() {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const user = await getCurrentUser();
    if (!user) throw new Error("LOGIN_REQUIRED");

    const [profileResponse, sessionsResponse, pointsResponse, visitsResponse, billingResponse] = await Promise.all([
      client.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      client
        .from("seat_sessions")
        .select("*, stores(name), seats(label)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("point_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      client
        .from("verified_visits")
        .select("*, stores(name)")
        .eq("user_id", user.id)
        .order("verified_at", { ascending: false })
        .limit(10),
      client
        .from("billing_events")
        .select("*, stores(name)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const responses = [sessionsResponse, pointsResponse, visitsResponse, billingResponse];
    const failed = responses.find((response) => response.error);
    if (failed) throw failed.error;

    return {
      profile: profileResponse.data || null,
      sessions: sessionsResponse.data || [],
      pointEvents: pointsResponse.data || [],
      verifiedVisits: visitsResponse.data || [],
      billingEvents: billingResponse.data || [],
    };
  }

  async function loadStores() {
    if (!client) return [];

    const [{ data: userData }, storesResponse, sessionsResponse, visitsResponse] = await Promise.all([
      client.auth.getUser(),
      client
        .from("stores")
        .select("*, seats(*), ad_campaigns(*)")
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      client.from("seat_sessions").select("*").eq("status", "active"),
      client.from("verified_visits").select("*"),
    ]);

    if (storesResponse.error) throw storesResponse.error;
    if (sessionsResponse.error) throw sessionsResponse.error;

    const user = userData?.user || null;
    const visits = visitsResponse.error ? [] : visitsResponse.data || [];
    return (storesResponse.data || []).map((store) =>
      mapStore(store, sessionsResponse.data || [], visits, user?.id || null),
    );
  }

  function mapStore(row, sessions, visits, currentUserId) {
    const activeBySeatId = new Map(sessions.map((session) => [session.seat_id, session]));
    const verifiedBySessionId = new Set(visits.map((visit) => visit.session_id).filter(Boolean));
    const seats = (row.seats || [])
      .filter((seat) => seat.is_active)
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "ko"))
      .map((seat, index) => mapSeat(seat, activeBySeatId.get(seat.id), verifiedBySessionId, currentUserId, index));

    const campaign = (row.ad_campaigns || []).find((item) => item.status === "active");
    const verifiedVisits = visits.filter((visit) => visit.store_id === row.id).length;
    const feePerVerifiedVisit = campaign?.fee_per_verified_visit || 300;

    return {
      id: row.id,
      externalId: row.external_place_id,
      source: row.external_source || "supabase",
      name: row.name,
      category: row.category,
      address: row.address,
      roadAddress: row.road_address || row.address,
      lat: row.latitude,
      lng: row.longitude,
      googleMapsUrl: createGoogleMapsSearchUrl(row.name, row.address, row.latitude, row.longitude),
      googleMapsEmbedUrl: createGoogleMapsEmbedUrl(row.name, row.address, row.latitude, row.longitude),
      totalSeats: row.total_seats || seats.length,
      note: "Supabase DB connected store",
      seats,
      floorPlanImage: row.floor_plan_image_url || null,
      adCampaign: {
        active: Boolean(campaign),
        id: campaign?.id || null,
        feePerVerifiedVisit,
        verifiedVisits,
        spend: verifiedVisits * feePerVerifiedVisit,
        budget: campaign?.daily_budget || 50000,
      },
      activity: ["Supabase DB data is loaded."],
    };
  }

  function mapSeat(row, activeSession, verifiedBySessionId, currentUserId, index) {
    return {
      id: row.id,
      label: row.label || `${index + 1}`,
      x: Number(row.x),
      y: Number(row.y),
      status: activeSession ? "occupied" : "available",
      startedAt: activeSession ? Date.parse(activeSession.created_at) : null,
      expectedEndAt: activeSession ? Date.parse(activeSession.expected_end_at) : null,
      userToken: activeSession?.user_id === currentUserId ? "me" : activeSession ? "visitor" : null,
      memo: activeSession?.memo || "",
      verifiedAt: activeSession && verifiedBySessionId.has(activeSession.id) ? Date.now() : null,
      remoteSessionId: activeSession?.id || null,
    };
  }

  async function startSeatSession({ storeId, seatId, expectedEndAt, memo }) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const user = await getCurrentUser();
    if (!user) throw new Error("LOGIN_REQUIRED");

    const { data, error } = await client
      .from("seat_sessions")
      .insert({
        store_id: storeId,
        seat_id: seatId,
        user_id: user.id,
        status: "active",
        expected_end_at: expectedEndAt,
        memo,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function endSeatSession(sessionId) {
    if (!client || !sessionId) return { earned: 0 };
    const { data, error } = await client.rpc("end_seat_session_with_points", {
      session_uuid: sessionId,
    });
    if (!error) return { earned: Number(data || 0) };

    console.warn("RPC finish failed, falling back to direct update", error);
    const { error: updateError } = await client
      .from("seat_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (updateError) throw updateError;
    return { earned: 0 };
  }

  async function verifyVisit({ storeId, sessionId, method = "receipt_code" }) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const user = await getCurrentUser();
    if (!user) throw new Error("LOGIN_REQUIRED");

    const { data: visit, error } = await client
      .from("verified_visits")
      .insert({
        store_id: storeId,
        user_id: user.id,
        session_id: sessionId,
        verification_method: method,
      })
      .select()
      .single();
    if (error) throw error;

    const { data: campaign } = await client
      .from("ad_campaigns")
      .select("*")
      .eq("store_id", storeId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (campaign) {
      await client.from("billing_events").insert({
        campaign_id: campaign.id,
        store_id: storeId,
        user_id: user.id,
        verified_visit_id: visit.id,
        amount: campaign.fee_per_verified_visit,
        reason: "verified_visit",
      });
    }

    return visit;
  }

  function subscribeToSeatSessions(onChange) {
    if (!client) return null;
    return client
      .channel("jaritnyang-seat-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "seat_sessions" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "verified_visits" }, onChange)
      .subscribe();
  }

  function createGoogleMapsSearchUrl(name, address, lat, lng) {
    if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`)}`;
  }

  function createGoogleMapsEmbedUrl(name, address, lat, lng) {
    if (lat && lng) {
      return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
    }
    return `https://maps.google.com/maps?q=${encodeURIComponent(`${name} ${address}`)}&z=16&output=embed`;
  }

  window.JaritnyangDB = {
    isConfigured: () => isConfigured,
    getClient,
    getCurrentUser,
    onAuthStateChange,
    signInWithOtp,
    signInWithOAuth,
    signOut,
    upsertProfile,
    updateProfile,
    loadAccountData,
    loadStores,
    startSeatSession,
    endSeatSession,
    verifyVisit,
    subscribeToSeatSessions,
  };
})();
