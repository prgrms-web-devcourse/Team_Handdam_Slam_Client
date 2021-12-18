import { useState, useCallback, useEffect, useMemo } from "react";
import { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import styled from "@emotion/styled";

import { getCurrentLocation } from "@utils/geolocation";
import { Button, ModalSheet, Spacer, Text } from "@components/base";
import {
  DatePicker,
  SlotPicker,
  BasketballMarker,
  Map,
  SlotKeyUnion,
  CourtItem,
} from "@components/domain";
import { useMapContext, useNavigationContext } from "@contexts/hooks";
import { useRouter } from "next/router";
import { courtApi } from "@service/.";
import type { Coord } from "../../types/map";

declare global {
  interface Window {
    kakao: any;
  }
}

// TODO: 노체와 중복되는 타입 공통화해서 중복 줄이기
interface Geocoder extends kakao.maps.services.Geocoder {
  coord2Address: (
    latitude: number,
    longitude: number,
    callback?: (result: any, status: any) => void
  ) => string;
  addressSearch: (
    address: string,
    callback?: (result: any, status: any) => void
  ) => void;
}

const getSlotFromDate = (date: Date): SlotKeyUnion => {
  const hour = date.getHours();
  let slot = "" as SlotKeyUnion;

  if (hour < 6) {
    slot = "dawn";
  } else if (hour < 12) {
    slot = "morning";
  } else if (hour < 18) {
    slot = "afternoon";
  } else if (hour <= 23) {
    slot = "night";
  }

  return slot;
};

const Courts: NextPage = () => {
  const router = useRouter();
  const {
    navigationProps,
    useMountPage,
    useDisableTopTransparent,
    useMountCustomButtonEvent,
  } = useNavigationContext();

  const { isTopTransparent } = navigationProps;

  useMountPage((page) => page.MAP);
  useDisableTopTransparent();
  useMountCustomButtonEvent("추가", () => {
    router.push("/courts/create");
  });

  const { map } = useMapContext();

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    return date;
  }, []);

  const [courts, setCourts] = useState<any>();

  const [level, setLevel] = useState<number>(3);
  const [center, setCenter] = useState<Coord>();

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [selectedSlot, setSelectedSlot] = useState<SlotKeyUnion>(() =>
    getSlotFromDate(new Date())
  );

  // TODO: API 명세 나올 경우 any 수정해주기
  const [selectedCourt, setSelectedCourt] = useState<any>(null);
  const [isAddressLoading, setIsAddressLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [snap, setSnap] = useState<number>(1);

  const onClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // TODO: 노체 코드와 동일한 부분 중복 줄이기, hooks로 빼기
  const searchAddrFromCoords = (latitude: number, longitude: number) => {
    const geocoder = new kakao.maps.services.Geocoder();

    setIsAddressLoading(true);

    const callback = (result: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        // 도로명 주소
        if (result[0].road_address) {
          setSelectedCourt((prev: any) => ({
            ...prev,
            address: result[0].road_address.address_name,
          }));
        }
        // 법정 주소
        else if (result[0].address.address_name) {
          setSelectedCourt((prev: any) => ({
            ...prev,
            address: result[0].address.address_name,
          }));
        }
        // 주소가 없는 경우
        else {
          setSelectedCourt((prev: any) => ({
            ...prev,
            address: "주소가 존재하지 않습니다.",
          }));
        }
      }

      setIsAddressLoading(false);
    };

    (geocoder as Geocoder).coord2Address(longitude, latitude, callback);
  };

  const handleChangedMapBounds = useCallback(
    async (map: kakao.maps.Map) => {
      const bounds = map.getBounds();
      const swLatlng = bounds.getSouthWest();
      const neLatLng = bounds.getNorthEast();

      const startLatitude = swLatlng.getLat();
      const startLongitude = swLatlng.getLng();

      const endLatitude = neLatLng.getLat();
      const endLongitude = neLatLng.getLng();

      const { courts } = await courtApi.getCourtsByCoordsAndDate({
        date: `${selectedDate.getFullYear()}-${
          selectedDate.getMonth() + 1
        }-${selectedDate.getDate()}`,
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
        time: selectedSlot,
      });

      setCourts(courts);
    },
    [selectedDate, selectedSlot]
  );

  const handleZoomIn = useCallback(() => {
    setLevel((level) => level - 1);
  }, []);

  const handleZoomOut = useCallback(() => {
    setLevel((level) => level + 1);
  }, []);

  const handleChangeSlot = useCallback((e) => {
    setSelectedSlot(e.target.value);
  }, []);

  const handleDateClick = useCallback((selectedDate: Date) => {
    setSelectedDate(selectedDate);
  }, []);

  const handleMarkerClick = useCallback((court: any) => {
    setIsOpen(true);
    searchAddrFromCoords(court.latitude, court.longitude);
    setSelectedCourt(court);
  }, []);

  const handleChangeSnap = useCallback((snap: number) => {
    setSnap(snap);
  }, []);

  const handleGetCurrentLocation = useCallback(async () => {
    getCurrentLocation(async ([latitude, longitude]) => {
      setCenter([latitude, longitude]);
    });
  }, []);

  useEffect(() => {
    const fetchCourts = async () => {
      if (map) {
        await handleChangedMapBounds(map);
      }
    };

    handleGetCurrentLocation();
    fetchCourts();
  }, [handleGetCurrentLocation, map]);

  useEffect(() => {
    if (map) {
      handleChangedMapBounds(map);
    }
  }, [map, handleChangedMapBounds]);

  const dateString = useMemo(
    () =>
      `${selectedDate.getFullYear()}-${
        selectedDate.getMonth() + 1
      }-${selectedDate.getDate()}`,
    [selectedDate]
  );

  return (
    <>
      <Head>
        <title>탐색 | Slam - 우리 주변 농구장을 빠르게</title>
      </Head>
      <DatePicker
        isBackgroundTransparent={isTopTransparent}
        startDate={today}
        selectedDate={selectedDate}
        onClick={handleDateClick}
      />

      {center ? (
        <Map.KakaoMap
          level={level}
          center={center}
          onDragEnd={handleChangedMapBounds}
        >
          <Map.ZoomButton onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />
          <Map.CurrentLocationButton
            onGetCurrentLocation={handleGetCurrentLocation}
          />
          <TopFixedSlotPicker
            selectedSlot={selectedSlot}
            onChange={handleChangeSlot}
          />

          {map &&
            courts &&
            courts.map((court: any) => (
              <BasketballMarker
                key={court.courtId}
                map={map}
                court={court}
                onClick={handleMarkerClick}
              />
            ))}
        </Map.KakaoMap>
      ) : (
        <div>현재 위치를 받아오는 중입니다.</div>
      )}

      <ModalSheet isOpen={isOpen} onClose={onClose} onSnap={handleChangeSnap}>
        {selectedCourt && (
          <ModalContentContainer>
            <Spacer gap="xs" type="vertical">
              <CourtItem.Header>{selectedCourt.courtName}</CourtItem.Header>
              <CourtItem.Address>{selectedCourt.address}</CourtItem.Address>
            </Spacer>
            <ReservationCount block strong size="lg">
              {selectedCourt.courtReservation} 명
            </ReservationCount>
            <Actions gap="xs">
              <CourtItem.FavoritesToggle courtId={selectedCourt.courtId} />
              <CourtItem.ShareButton />
              <CourtItem.ChatLink courtId={selectedCourt.courtId} />
              <CourtItem.KakaoMapLink
                latitude={selectedCourt.latitude}
                longitude={selectedCourt.longitude}
                courtName={selectedCourt.courtName}
              />
              <Link
                href={{
                  pathname: `/courts/[courtId]/[date]`,
                  query: {
                    timeSlot: selectedSlot,
                  },
                }}
                as={`/courts/${
                  selectedCourt.courtId
                }/${selectedDate.getFullYear()}-${
                  selectedDate.getMonth() + 1
                }-${selectedDate.getDate()}`}
                passHref
              >
                <Button style={{ flex: 1 }} size="lg">
                  예약하기
                </Button>
              </Link>
            </Actions>

            {snap === 0 ? (
              <>
                <div>농구장 사진</div>
                <div
                  style={{
                    width: "100%",
                    height: 200,
                    backgroundColor: "orange",
                  }}
                >
                  농구장 사진사진
                </div>

                <div>코트 바닥 정보</div>
                <div>고무고무</div>
              </>
            ) : null}
          </ModalContentContainer>
        )}
      </ModalSheet>
    </>
  );
};

export default Courts;

const TopFixedSlotPicker = styled(SlotPicker)`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  filter: ${({ theme }) => theme.filter.dropShadow};
`;

const Actions = styled(Spacer)`
  margin-top: ${({ theme }) => theme.gaps.sm};
`;

const ModalContentContainer = styled.div`
  margin: 0 20px;
  margin-top: 10px;
`;

const ReservationCount = styled(Text)`
  color: ${({ theme }) => theme.colors.gray800};
  margin-top: ${({ theme }) => theme.gaps.md};
`;
