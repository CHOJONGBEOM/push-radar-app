if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/JB/.gradle/caches/9.0.0/transforms/031b586c28af725e029ebdd0132d5ca1/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/libs/android.armeabi-v7a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/JB/.gradle/caches/9.0.0/transforms/031b586c28af725e029ebdd0132d5ca1/transformed/hermes-android-0.81.5-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

